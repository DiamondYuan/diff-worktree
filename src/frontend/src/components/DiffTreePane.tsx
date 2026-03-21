import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, MutableRefObject } from "react";
import { ChevronRight, File } from "lucide-react";

import type { DiffTreeNode } from "../types";

interface DiffTreePaneProps {
  nodes: DiffTreeNode[];
  loading: boolean;
  selectedPath?: string;
  selectedFilePath?: string;
  selectedBranch?: string;
  onSelectFile: (filePath: string) => void;
  onSelectItem?: (node: DiffTreeNode) => void;
  onUseRemote?: (filePath: string) => void;
}

interface VisibleTreeNode {
  node: DiffTreeNode;
  depth: number;
  parentPath?: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  filePath: string;
}

function TreeEmptyState({ branchName }: { branchName?: string }) {
  return (
    <div className="empty-state-shell empty-state-shell-centered">
      <div className="empty-state-card empty-state-card-subtle">
        <h3 className="empty-state-title">No file changes to review</h3>
        <p className="empty-state-description">
          {branchName
            ? `The workspace currently matches ${branchName}. Switch branches or make edits to inspect a new diff.`
            : "The workspace currently matches the selected baseline. Switch branches or make edits to inspect a new diff."}
        </p>
      </div>
    </div>
  );
}

function statusLabel(node: DiffTreeNode) {
  switch (node.changeType) {
    case "added":
      return "A";
    case "modified":
      return "M";
    case "deleted":
      return "D";
    case "renamed":
      return "R";
    default:
      return "";
  }
}

function itemAriaLabel(node: DiffTreeNode) {
  if (node.type === "directory") {
    return node.name;
  }

  if (node.changeType === "renamed" && node.oldPath) {
    return `${node.name} (renamed from ${node.oldPath})`;
  }

  return node.name;
}

function rowStyle(depth: number): CSSProperties {
  return {
    "--tree-depth": depth,
  } as CSSProperties;
}

function collectDirectoryPaths(nodes: DiffTreeNode[]): string[] {
  const paths: string[] = [];

  for (const node of nodes) {
    if (node.type !== "directory") {
      continue;
    }

    paths.push(node.path, ...collectDirectoryPaths(node.children ?? []));
  }

  return paths;
}

function flattenVisibleNodes(
  nodes: DiffTreeNode[],
  collapsedPaths: Set<string>,
  depth = 0,
  parentPath?: string,
): VisibleTreeNode[] {
  const visibleNodes: VisibleTreeNode[] = [];

  for (const node of nodes) {
    visibleNodes.push({ node, depth, parentPath });

    if (node.type === "directory" && !collapsedPaths.has(node.path)) {
      visibleNodes.push(
        ...flattenVisibleNodes(node.children ?? [], collapsedPaths, depth + 1, node.path),
      );
    }
  }

  return visibleNodes;
}

function focusItem(
  refs: MutableRefObject<Map<string, HTMLButtonElement>>,
  path: string | undefined,
) {
  if (!path) {
    return;
  }

  const element = refs.current.get(path);
  if (element) {
    element.focus();
  }
}

export function DiffTreePane({
  nodes,
  loading,
  selectedPath,
  selectedFilePath,
  selectedBranch,
  onSelectFile,
  onSelectItem,
  onUseRemote,
}: DiffTreePaneProps) {
  const [collapsedPaths, setCollapsedPaths] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const itemRefs = useRef(new Map<string, HTMLButtonElement>());
  const activePath = selectedPath ?? selectedFilePath;
  const visibleNodes = flattenVisibleNodes(nodes, collapsedPaths);

  useEffect(() => {
    const validPaths = new Set(collectDirectoryPaths(nodes));
    setCollapsedPaths((current) => new Set([...current].filter((path) => validPaths.has(path))));
  }, [nodes]);

  useEffect(() => {
    focusItem(itemRefs, activePath);
  }, [activePath]);

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("contextmenu", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("contextmenu", close);
    };
  }, [contextMenu]);

  function handleSelect(node: DiffTreeNode) {
    if (onSelectItem) {
      onSelectItem(node);
      return;
    }

    if (node.type === "file") {
      onSelectFile(node.path);
    }
  }

  function toggleDirectory(path: string) {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, item: VisibleTreeNode) {
    const currentIndex = visibleNodes.findIndex((entry) => entry.node.path === item.node.path);
    if (currentIndex === -1) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextItem = visibleNodes[currentIndex + 1];
      if (nextItem) {
        handleSelect(nextItem.node);
      }
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const previousItem = visibleNodes[currentIndex - 1];
      if (previousItem) {
        handleSelect(previousItem.node);
      }
      return;
    }

    if (item.node.type !== "directory") {
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (collapsedPaths.has(item.node.path)) {
        toggleDirectory(item.node.path);
      }
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (!collapsedPaths.has(item.node.path)) {
        toggleDirectory(item.node.path);
        return;
      }

      if (item.parentPath) {
        const parent = visibleNodes.find((entry) => entry.node.path === item.parentPath);
        if (parent) {
          handleSelect(parent.node);
        }
      }
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleDirectory(item.node.path);
    }
  }

  return (
    <section className="pane">
      <header className="pane-header">
        <span className="pane-meta">{selectedBranch ? `${selectedBranch} vs workspace` : "no branch"}</span>
      </header>
      <div className={`pane-body${!loading && nodes.length === 0 ? " pane-body-empty" : ""}`}>
        {loading ? <div className="empty-state">Loading diff tree...</div> : null}
        {!loading && nodes.length === 0 ? <TreeEmptyState branchName={selectedBranch} /> : null}
        {!loading && nodes.length > 0 ? (
          <div className="tree-list">
            {visibleNodes.map((item) => {
              const selected = activePath === item.node.path;
              const isDirectory = item.node.type === "directory";
              const expanded = isDirectory && !collapsedPaths.has(item.node.path);

              return (
                <div
                  className={`tree-row${selected ? " tree-row-selected" : ""}`}
                  data-depth={item.depth}
                  key={item.node.path}
                  style={rowStyle(item.depth)}
                >
                  {isDirectory ? (
                    <button
                      aria-label={expanded ? `Collapse ${item.node.name}` : `Expand ${item.node.name}`}
                      className="tree-toggle"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleDirectory(item.node.path);
                      }}
                      type="button"
                    >
                      <ChevronRight className={`tree-directory-chevron${expanded ? " tree-directory-chevron-open" : ""}`} size={14} strokeWidth={1.8} />
                    </button>
                  ) : (
                    <span aria-hidden="true" className="tree-toggle-spacer" />
                  )}
                  <button
                    aria-expanded={isDirectory ? expanded : undefined}
                    aria-label={itemAriaLabel(item.node)}
                    className={`tree-entry${isDirectory ? " tree-entry-directory" : " tree-entry-file"}${selected ? " tree-entry-selected" : ""}`}
                    onClick={() => handleSelect(item.node)}
                    onContextMenu={
                      !isDirectory && onUseRemote
                        ? (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            setContextMenu({ x: event.clientX, y: event.clientY, filePath: item.node.path });
                          }
                        : undefined
                    }
                    onKeyDown={(event) => handleKeyDown(event, item)}
                    ref={(element) => {
                      if (element) {
                        itemRefs.current.set(item.node.path, element);
                      } else {
                        itemRefs.current.delete(item.node.path);
                      }
                    }}
                    type="button"
                  >
                    <span className={`tree-entry-main${isDirectory ? " tree-entry-main-directory" : ""}`}>
                      {!isDirectory ? (
                        <span aria-hidden="true" className="tree-entry-icon">
                          <File className="tree-file-icon" size={14} strokeWidth={1.8} />
                        </span>
                      ) : null}
                      <span className={isDirectory ? "tree-directory-label" : "tree-file-content"}>
                        <span className="tree-file-label">{item.node.name}</span>
                        {!isDirectory && item.node.changeType === "renamed" && item.node.oldPath ? (
                          <span className="tree-file-hint">renamed from {item.node.oldPath}</span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                  {!isDirectory ? (
                    <span aria-hidden="true" className={`tree-file-status tree-file-status-${item.node.changeType}`}>
                      {statusLabel(item.node)}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
      {contextMenu && onUseRemote ? (
        <div
          className="context-menu"
          style={{ position: "fixed", left: contextMenu.x, top: contextMenu.y }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              onUseRemote(contextMenu.filePath);
              setContextMenu(null);
            }}
            type="button"
          >
            Use Remote
          </button>
        </div>
      ) : null}
    </section>
  );
}
