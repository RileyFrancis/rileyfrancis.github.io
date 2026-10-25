# frozen_string_literal: true

# Builds the /cv/ page and the downloadable PDF from the LaTeX resume in _cv/.
#
# 1. Parses _cv/resume.tex into site.data["cv"], which cv.html renders. Only
#    the small subset of LaTeX the resume class uses is understood: rSection
#    environments; entries made of `\\`-separated lines, each split by \hfill
#    into a left and right part; itemize bullets; one tabular of skills; and
#    inline \textbf, {\bf ...}, \textit, \emph, \href, \url and escapes.
#    Unknown commands are dropped with a warning rather than failing the build.
#
# 2. Compiles the public copy of the PDF with latexmk (\publicversion defined,
#    so \private{...} content such as the phone number is left out) and
#    publishes it at the configured path. The compile is cached on the source
#    files' contents, so unrelated edits don't rerun LaTeX. If latexmk isn't
#    installed the page still builds, just without the download button; a
#    LaTeX error fails the build so a broken resume is never deployed.
#
# The website hooks \webonly, \weblink and \private are defined in
# _cv/resume.cls, which makes the PDF ignore them.
#
# Config (_config.yml), all optional:
#   latex_cv:
#     source: _cv/resume.tex
#     pdf: assets/Riley_Francis_Resume.pdf

require "cgi"
require "digest"
require "fileutils"
require "open3"

module LatexCv
  class Generator < Jekyll::Generator
    safe true
    priority :high

    def generate(site)
      config = site.config["latex_cv"] || {}
      tex_path = site.in_source_dir(config["source"] || "_cv/resume.tex")
      pdf_rel = config["pdf"] || "assets/Riley_Francis_Resume.pdf"

      unless File.exist?(tex_path)
        Jekyll.logger.warn "LaTeX CV:", "#{tex_path} not found; skipping /cv/ data"
        return
      end

      data = Parser.new(File.read(tex_path), baseurl: site.baseurl.to_s).parse
      data["pdf_url"] = PdfBuilder.new(site, tex_path, pdf_rel).build
      site.data["cv"] = data
    end
  end

  # Compiles the public PDF into .jekyll-cache and registers it as a static file.
  class PdfBuilder
    def initialize(site, tex_path, pdf_rel)
      @site = site
      @tex_path = tex_path
      @pdf_dir = File.dirname(pdf_rel)
      @pdf_name = File.basename(pdf_rel)
      @cache_root = site.in_source_dir(".jekyll-cache", "latex-cv")
    end

    # Returns the PDF's URL, or nil when LaTeX isn't available.
    def build
      unless latexmk_available?
        Jekyll.logger.warn "LaTeX CV:", "latexmk not found; building /cv/ without the PDF download"
        return nil
      end

      out_pdf = File.join(@cache_root, @pdf_dir, @pdf_name)
      stamp = File.join(@cache_root, "source.sha256")
      digest = source_digest
      compile(out_pdf) unless File.exist?(out_pdf) && File.exist?(stamp) && File.read(stamp) == digest
      File.write(stamp, digest)

      @site.static_files << Jekyll::StaticFile.new(@site, @cache_root, @pdf_dir, @pdf_name)
      "#{@site.baseurl}/#{@pdf_dir}/#{@pdf_name}".squeeze("/")
    end

    private

    def latexmk_available?
      _, status = Open3.capture2e("latexmk", "-v")
      status.success?
    rescue Errno::ENOENT
      false
    end

    # Everything in the source folder (the .tex, the class file, any inputs).
    def source_digest
      files = Dir[File.join(File.dirname(@tex_path), "**", "*.{tex,cls,sty}")].sort
      Digest::SHA256.hexdigest(files.map { |f| f + File.read(f) }.join)
    end

    def compile(out_pdf)
      build_dir = File.join(@cache_root, "build")
      FileUtils.mkdir_p(build_dir)
      Jekyll.logger.info "LaTeX CV:", "compiling #{File.basename(@tex_path)}"
      cmd = ["latexmk", "-pdf", "-interaction=nonstopmode", "-halt-on-error",
             "-usepretex=\\def\\publicversion{}", "-outdir=#{build_dir}", File.basename(@tex_path)]
      log, status = Open3.capture2e(*cmd, chdir: File.dirname(@tex_path))
      unless status.success?
        raise Jekyll::Errors::FatalException,
              "LaTeX CV: latexmk failed for #{@tex_path}:\n#{log.lines.last(30).join}"
      end

      FileUtils.mkdir_p(File.dirname(out_pdf))
      FileUtils.cp(File.join(build_dir, File.basename(@tex_path, ".tex") + ".pdf"), out_pdf)
    end
  end

  # Turns resume.tex into { "sections" => [{ "title", "id", "blocks" }] }.
  # Each block is one of:
  #   { "type" => "entry", "rows" => [{ "left", "right" }], "bullets" => [...] }
  #   { "type" => "table", "rows" => [{ "label", "value" }] }
  #   { "type" => "text",  "html" => "..." }
  # All strings are HTML.
  class Parser
    ESCAPES = { "&" => "&amp;", "%" => "%", "$" => "$", "#" => "#", "_" => "_",
                "{" => "{", "}" => "}", " " => " ", "," => "&thinsp;" }.freeze
    WRAPPERS = { "textbf" => "strong", "textit" => "em", "emph" => "em",
                 "textsl" => "em", "texttt" => "code", "underline" => "u" }.freeze
    DECLARATIONS = { "bf" => "strong", "bfseries" => "strong", "it" => "em",
                     "itshape" => "em", "em" => "em", "sl" => "em", "tt" => "code" }.freeze
    WORDS = { "LaTeX" => "LaTeX", "TeX" => "TeX", "ldots" => "…", "textbar" => "|" }.freeze
    # Spacing and layout commands with nothing to show on the web.
    IGNORED = %w(itemsep hfill hspace vspace smallskip medskip bigskip noindent
                 newline par centering raggedright).freeze

    def initialize(source, baseurl: "")
      @source = source
      @baseurl = baseurl
    end

    def parse
      body = strip_comments(@source)
      body = body[/\\begin\{document\}(.*)\\end\{document\}/m, 1] || ""
      body = expand_web_macros(body)

      sections = body.scan(/\\begin\{rSection\}\{(.*?)\}(.*?)\\end\{rSection\}/m).map do |title, content|
        title_html = inline(title)
        { "title" => title_html,
          "id" => Jekyll::Utils.slugify(CGI.unescapeHTML(title_html.gsub(/<[^>]+>/, ""))),
          "blocks" => blocks(content), }
      end
      { "sections" => sections }
    end

    private

    # `%` starts a comment unless escaped; like TeX, it also eats the line
    # break and the next line's indentation.
    def strip_comments(text)
      text.gsub(/(?<!\\)%[^\n]*\n?[ \t]*/, "")
    end

    # \webonly{x} -> x, \private{x} -> nothing. \weblink stays for inline().
    def expand_web_macros(text)
      out = +""
      i = 0
      while (m = /\\(webonly|private)\s*\{/.match(text, i))
        out << text[i...m.begin(0)]
        content, i = read_group(text, m.end(0) - 1)
        out << expand_web_macros(content) if m[1] == "webonly"
      end
      out << text[i..-1]
    end

    # Reads a {...} group starting at text[open]; returns [content, index after it].
    def read_group(text, open)
      depth = 0
      i = open
      while i < text.length
        case text[i]
        when "\\" then i += 1 # skip the escaped character
        when "{" then depth += 1
        when "}"
          depth -= 1
          return [text[(open + 1)...i], i + 1] if depth.zero?
        end
        i += 1
      end
      raise Jekyll::Errors::FatalException, "LaTeX CV: unbalanced braces near: #{text[open, 60].inspect}"
    end

    # A section body is a run of paragraphs (blank-line separated); a list also
    # ends a paragraph, as in LaTeX.
    def blocks(content)
      content.split(/\n[ \t]*\n/)
        .flat_map { |para| para.split(/(?<=\\end\{itemize\})/) }
        .map(&:strip).reject(&:empty?)
        .map { |para| block(para) }
    end

    def block(para)
      return table(para) if para.include?("\\begin{tabular}")

      header, list = para.split("\\begin{itemize}", 2)
      bullets = list ? list.sub(/\\end\{itemize\}.*/m, "").split(/\\item\b/).drop(1) : []
      bullets = bullets.map { |b| inline(b) }.reject(&:empty?)

      rows = split_rows(header).map do |line|
        left, right = line.split(/\\hfill\b/, 2)
        { "left" => inline(left.to_s), "right" => right && inline(right) }
      end
      rows.reject! { |r| r["left"].empty? && r["right"].to_s.empty? }

      if bullets.empty? && rows.length == 1 && rows[0]["right"].nil?
        { "type" => "text", "html" => rows[0]["left"] }
      else
        { "type" => "entry", "rows" => rows, "bullets" => bullets }
      end
    end

    def table(para)
      inner = para[/\\begin\{tabular\}(.*?)\\end\{tabular\}/m, 1]
      inner = inner.lstrip
      _, rest = read_group(inner, 0) # column spec
      rows = []
      split_rows(inner[rest..-1]).each do |line|
        label, value = line.split(/(?<!\\)&/, 2).map(&:strip)
        next if label.to_s.empty? && value.to_s.empty?

        if label.empty? && rows.any?
          rows.last["value"] += " " + inline(value.to_s) # continuation line
        else
          rows << { "label" => inline(label), "value" => inline(value.to_s) }
        end
      end
      { "type" => "table", "rows" => rows }
    end

    def split_rows(text)
      text.split(/\\\\(?:\[[^\]]*\])?/)
    end

    # Converts inline LaTeX to HTML.
    def inline(text)
      html = +""
      i = 0
      while i < text.length
        c = text[i]
        if c == "\\"
          name = text[(i + 1)..-1][/\A([A-Za-z]+|.)/m, 1].to_s
          i += 1 + name.length
          i = text.index(/\S/, i) || text.length if name.match?(/\A[A-Za-z]+\z/) && text[i] == " " && !takes_args?(name)
          piece, i = command(name, text, i)
          html << piece
        elsif c == "{"
          content, i = read_group(text, i)
          html << group(content)
        elsif text[i, 3] == "---"
          html << "—"
          i += 3
        elsif text[i, 2] == "--"
          html << "–"
          i += 2
        elsif text[i, 2] == "``"
          html << "“"
          i += 2
        elsif text[i, 2] == "''"
          html << "”"
          i += 2
        else
          html << case c
                  when "'" then "’"
                  when "`" then "‘"
                  when "~" then "&nbsp;"
                  when "$", "}" then ""
                  else CGI.escapeHTML(c)
                  end
          i += 1
        end
      end
      html.gsub(/\s+/, " ").strip
    end

    def takes_args?(name)
      WRAPPERS.key?(name) || %w(href url weblink).include?(name)
    end

    # Handles the command `name` whose arguments start at text[i].
    def command(name, text, i)
      if ESCAPES.key?(name) then [ESCAPES[name], i]
      elsif name == "\\" then ["<br>", i]
      elsif WORDS.key?(name) then [WORDS[name], i]
      elsif WRAPPERS.key?(name)
        arg, i = argument(text, i)
        tag = WRAPPERS[name]
        ["<#{tag}>#{inline(arg)}</#{tag}>", i]
      elsif %w(href weblink).include?(name)
        url, i = argument(text, i)
        label, i = argument(text, i)
        [link(url, inline(label)), i]
      elsif name == "url"
        url, i = argument(text, i)
        [link(url, CGI.escapeHTML(url)), i]
      elsif DECLARATIONS.key?(name) || IGNORED.include?(name)
        # A bare declaration outside a group, or spacing: drop it and any
        # dimension/argument that follows (\itemsep -4pt, \hspace{2ex}).
        rest = text[i..-1]
        skip = rest[/\A\s*(?:\{[^{}]*\}|-?[\d.]+\s*[a-z]{2})?/].to_s.length
        ["", i + skip]
      else
        Jekyll.logger.warn "LaTeX CV:", "ignoring unknown command \\#{name}"
        ["", i]
      end
    end

    def argument(text, i)
      i = text.index(/\S/, i) || text.length
      return ["", i] unless text[i] == "{"

      read_group(text, i)
    end

    # {\bf ...} and friends style the rest of their group.
    def group(content)
      m = /\A\s*\\([A-Za-z]+)\b\s*/.match(content)
      return inline(content) unless m && DECLARATIONS.key?(m[1])

      tag = DECLARATIONS[m[1]]
      "<#{tag}>#{inline(m.post_match)}</#{tag}>"
    end

    def link(url, label)
      url = url.strip
      href = url.start_with?("/") ? "#{@baseurl}#{url}" : url
      attrs = if href.match?(%r{\A(https?:)?//}) || href.end_with?(".pdf")
                ' target="_blank" rel="noopener noreferrer"'
              else
                ""
              end
      %(<a href="#{CGI.escapeHTML(href)}"#{attrs}>#{label}</a>)
    end
  end
end
