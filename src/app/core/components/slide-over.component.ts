import { Component, EventEmitter, Input, Output, OnChanges } from '@angular/core';

@Component({
  selector: 'app-slide-over',
  standalone: true,
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50 flex justify-end">
        <div class="absolute inset-0 bg-black/30" (click)="onClose.emit()"></div>
        <div class="relative bg-white shadow-xl flex flex-col h-full overflow-hidden"
             [style.width]="'min(100vw, ' + width + ')'">
          <div class="flex items-center justify-between px-5 py-3.5 border-b border-[#E0E0E0] bg-[#F5F5F5]">
            <h2 class="text-[16px] font-semibold text-[#333]">{{ title }}</h2>
            <button (click)="onClose.emit()"
                    class="p-1 rounded hover:bg-[#E0E0E0] text-[#666]">
              <i class="pi pi-times text-[14px]"></i>
            </button>
          </div>
          <div class="flex-1 overflow-y-auto px-5 py-4">
            <ng-content />
          </div>
        </div>
      </div>
    }
  `
})
export class SlideOverComponent implements OnChanges {
  @Input() open = false;
  @Input() title = '';
  @Input() width = '480px';
  @Output() onClose = new EventEmitter<void>();

  ngOnChanges() {
    document.body.style.overflow = this.open ? 'hidden' : '';
  }
}
