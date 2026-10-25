# rileyfrancis.github.io

Source for [rileyfrancis.github.io](https://rileyfrancis.github.io), my personal site — resume/CV, projects, and coursework — built with Jekyll and deployed to GitHub Pages by GitHub Actions (`.github/workflows/pages.yml`).

## Local development

```sh
script/bootstrap        # install dependencies
bundle exec jekyll serve   # serve at localhost:4000 with live rebuild
```

The CV page and its PDF download are built from the LaTeX in `_cv/resume.tex`, so building them needs LaTeX (`sudo apt install latexmk texlive-latex-base texlive-latex-recommended`). Without it the site still builds, minus the PDF.

## Updating the CV

Edit `_cv/resume.tex`; the `/cv/` page and `assets/Riley_Francis_Resume.pdf` are regenerated from it on every build (and live under `jekyll serve`). Extra hooks, defined in `_cv/resume.cls`, that leave the normal PDF unchanged:

- `\webonly{...}` — content shown on the website only.
- `\weblink{url}{text}` — a link on the website, plain text in the PDF.
- `\private{...}` — kept when you compile the PDF yourself, left out of the copy published on the site.

## Testing

```sh
script/cibuild
```

Runs a full build, then `htmlproofer`, `rubocop`, and HTML/CSS validation against the built site. CI runs this on every push and pull request (`.github/workflows/ci.yaml`).
