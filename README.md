# rileyfrancis.github.io

Source for [rileyfrancis.github.io](https://rileyfrancis.github.io), my personal site — resume/CV, projects, and coursework — built with Jekyll on GitHub Pages.

## Local development

```sh
script/bootstrap        # install dependencies
bundle exec jekyll serve   # serve at localhost:4000 with live rebuild
```

## Testing

```sh
script/cibuild
```

Runs a full build, then `htmlproofer`, `rubocop`, and HTML/CSS validation against the built site. CI runs this on every push and pull request (`.github/workflows/ci.yaml`).
