import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    @if (open) {
      <div class="fixed inset-0 z-[60] flex items-center justify-center">
        <div class="absolute inset-0 bg-black/30" (click)="onCancel.emit()"></div>
        <div class="relative bg-white rounded shadow-xl w-[calc(100vw-2rem)] sm:w-[420px] max-w-[420px] p-4 sm:p-6">
          <div class="flex items-start gap-3 mb-4">
            <i class="pi pi-exclamation-triangle text-[22px] mt-0.5"
               [class.text-[#D9534F]]="variant === 'danger'"
               [class.text-[#F0AD4E]]="variant === 'warning'"></i>
            <div>
              <div class="text-[15px] font-semibold text-[#333] mb-1">{{ title }}</div>
              <div class="text-[13px] text-[#666]">{{ message }}</div>
            </div>
          </div>
          <div class="flex justify-end gap-2 mt-4">
            <button (click)="onCancel.emit()"
                    class="px-4 py-1.5 text-[13px] border border-[#CCC] rounded text-[#555] hover:bg-[#F5F5F5]">
              {{ cancelLabel }}
            </button>
            <button (click)="onConfirm.emit()"
                    class="px-4 py-1.5 text-[13px] rounded text-white"
                    [class.bg-[#D9534F]]="variant === 'danger'"
                    [class.hover:bg-[#C9302C]]="variant === 'danger'"
                    [class.bg-[#F0AD4E]]="variant === 'warning'"
                    [class.hover:bg-[#EC971F]]="variant === 'warning'">
              {{ confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = '';
  @Input() message = '';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() variant: 'danger' | 'warning' = 'danger';
  @Output() onConfirm = new EventEmitter<void>();
  @Output() onCancel = new EventEmitter<void>();
}
