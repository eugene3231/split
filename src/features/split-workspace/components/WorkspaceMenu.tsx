import { useRef, useState, type ChangeEvent, type ComponentProps } from 'react';
import { useReceiptStore } from '@features/split-workspace/stores/receiptStore';
import { useMenuDismiss } from '@features/split-workspace/hooks/useMenuDismiss';
import { ConfirmDialog } from '@features/split-workspace/components/shared/ConfirmDialog';
import { PRESET_WORKSPACES } from '@features/split-workspace/logic/presetWorkspaces';
import {
  downloadWorkspaceFile,
  hasWorkspaceContent,
  readWorkspaceFile,
} from '@features/split-workspace/logic/workspaceTransfer';
import type { SessionDraft } from '@features/split-workspace/types';
import { cn } from '@shared/utils/cn';

interface WorkspaceMenuProps {
  onLoadWorkspace: (draft: SessionDraft) => void;
}

interface PendingLoad {
  draft: SessionDraft;
  source: string;
}

export function WorkspaceMenu({ onLoadWorkspace }: WorkspaceMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [importFailed, setImportFailed] = useState(false);
  const [pendingLoad, setPendingLoad] = useState<PendingLoad | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeMenu = () => {
    setIsOpen(false);
    setImportFailed(false);
  };
  useMenuDismiss(containerRef, isOpen, closeMenu);

  const requestLoad = (load: PendingLoad) => {
    closeMenu();
    const { people, receipts } = useReceiptStore.getState();
    if (hasWorkspaceContent(people, receipts)) {
      setPendingLoad(load);
      return;
    }
    onLoadWorkspace(load.draft);
  };

  const handleExport = () => {
    closeMenu();
    downloadWorkspaceFile(useReceiptStore.getState().getExportJson());
  };

  const handleImportClick = () => {
    closeMenu();
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const draft = await readWorkspaceFile(file);
    if (!draft) {
      setImportFailed(true);
      setIsOpen(true);
      return;
    }
    requestLoad({ draft, source: file.name });
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        data-testid="workspace-menu-btn"
        aria-label="Split menu"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? closeMenu() : setIsOpen(true))}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface active:scale-95',
          isOpen && 'bg-surface-container-low text-on-surface',
        )}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-xl">
          more_vert
        </span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        data-testid="workspace-import-input"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleFileChange}
      />

      {isOpen && (
        <div
          role="menu"
          aria-label="Split menu"
          className="absolute top-full right-0 z-50 mt-2 w-64 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-1.5 shadow-xl"
        >
          {importFailed && (
            <p role="alert" className="px-3 py-2 text-xs font-medium text-error">
              That file isn&apos;t a Split export.
            </p>
          )}
          <MenuItem
            icon="upload_file"
            data-testid="workspace-import-btn"
            onClick={handleImportClick}
          >
            Import from file
          </MenuItem>
          <MenuItem icon="download" data-testid="workspace-export-btn" onClick={handleExport}>
            Export to file
          </MenuItem>

          <div role="separator" className="mx-3 my-1.5 border-t border-surface-container-high" />
          <p className="px-3 pt-1 pb-1 text-[10px] font-bold tracking-widest text-on-surface-variant uppercase">
            Test splits
          </p>
          {PRESET_WORKSPACES.map((preset) => (
            <MenuItem
              key={preset.id}
              icon="restaurant"
              data-testid={`workspace-preset-${preset.id}`}
              onClick={() => requestLoad({ draft: preset.build(), source: preset.label })}
            >
              <span className="block">{preset.label}</span>
              <span className="block text-xs text-on-surface-variant">{preset.description}</span>
            </MenuItem>
          ))}
        </div>
      )}

      {pendingLoad && (
        <ConfirmDialog
          title="Replace this split?"
          confirmLabel="Replace split"
          onCancel={() => setPendingLoad(null)}
          onConfirm={() => {
            setPendingLoad(null);
            onLoadWorkspace(pendingLoad.draft);
          }}
        >
          Loading {pendingLoad.source} removes everyone and every receipt in the current split.
          Export it first if you want to keep a copy.
        </ConfirmDialog>
      )}
    </div>
  );
}

interface MenuItemProps extends ComponentProps<'button'> {
  icon: string;
}

function MenuItem({ icon, children, className, ...props }: MenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden="true"
        className="material-symbols-outlined text-lg text-on-surface-variant"
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}
