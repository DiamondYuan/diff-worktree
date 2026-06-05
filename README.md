# diff-worktree

[中文文档](README.zh-CN.md)

`diff-worktree` is a CLI-launched local Git worktree review tool. It starts a local web UI for the current repository and lets you compare your workspace against a selected local branch, review files before committing, mark files as reviewed, and quickly discard changes you do not want to keep.

![diff-worktree UI](docs/images/diff-worktree-ui.png)

## Features

- Local branch list: shows local branches, the current branch, upstream status, and ahead/behind counts.
- Workspace change tree: groups added, modified, deleted, and renamed files by directory.
- Side-by-side diff: compares the selected branch on the left with your local workspace on the right, rendered with Monaco Editor.
- Direct workspace editing: edits in the right-side editor are saved back to local files automatically.
- Review progress: mark files as reviewed; review state is invalidated when file content changes.
- File highlight rules: configure glob patterns to highlight files such as tests or specific directories.
- Use target version: right-click a file in the change tree and choose `Use Remote` to replace the workspace file with the selected branch version.
- Branch actions: refresh repository state, fast-forward local branches when possible, and delete non-current local branches.

## Usage

Run this inside a Git repository:

```sh
npx diff-worktree
```

The command prints the local URL and opens the browser by default.

You can also pass a repository path:

```sh
npx diff-worktree /path/to/repo
```

Common options:

```sh
npx diff-worktree --port 3000
npx diff-worktree --no-open
```

| Option | Description |
| --- | --- |
| `[cwd]` | Git repository path. Defaults to the current directory. |
| `--port <port>` | Local web server port. Defaults to an automatically selected available port. |
| `--no-open` | Do not open the browser after startup. |

## Workflow

1. Select a local branch in the left panel as the comparison target.
2. Review the workspace changes relative to that branch in the middle panel.
3. Select a file to open a side-by-side diff in the right panel.
4. Edit the right side to write changes directly back to the workspace file.
5. Mark files as reviewed and track progress at the top of the change tree.

## Local Development

```sh
pnpm install
pnpm run dev
```

Build the package:

```sh
pnpm run build
```
