import { Component, OnInit, OnChanges, AfterViewInit, ViewChild, ElementRef, Input, Output, EventEmitter } from '@angular/core';
import { InfiniteCalendarOptions } from './infinite-calendar-options';
import { I18n } from './i18n';
import { ExtDate, ExtInterval } from 'extdate';
import { InfiniteCalendarEvent } from './infinite-calendar-event';
import { ExtDateWithEvent } from './infinite-calendar-date-with-event';

declare const Math;
const PANE_HEIGHT = 325;
const ROW_HEIGHT = 65.594;
const CALENDAR_KEY_FORMAT = '%Y-%m-%d';

const DEFAULT_OPTIONS: InfiniteCalendarOptions = {
  style: {
    height: PANE_HEIGHT,
  },
  navigator: {
    today: true,
    labelForToday: 'Today',
  },
  label: {
    lang: 'enUS',
    short: true,
  }
};

@Component({
  selector: 'tp-infinite-calendar',
  template: `
  <div #awesomeCalendar class="awesome-calendar">
    <div class="container">
      <div class="scroll-view-outer-container">
        <div #scrollView
            class="scroll-view-inner-container"
            (scroll)="onScroll($event)">
          <div class="scroll-view" (touchmove)="onScroll($event)">
            <div class="row" *ngFor="let week of pAddr">
              <span class="cell"
                    *ngFor="let date of week"
                    [ngClass]="{
                      'range': vAddr[date.x][date.y].range,
                      'end': vAddr[date.x][date.y].end,
                      'current': vAddr[date.x][date.y].current,
                      'holiday': vAddr[date.x][date.y].holiday,
                      'selected': vAddr[date.x][date.y].selected
                    }"
                    (click)="onClickDate($event, date)"
                    (mouseover)="onMouseoverDate($event, date)">

                <div class="date-container">
                  <span class="first-day" *ngIf="vAddr[date.x][date.y].firstDayOfMonth">
                    {{ vAddr[date.x][date.y].date.date | date: dateFormat }}
                  </span>
                  <span class="day" *ngIf="!vAddr[date.x][date.y].firstDayOfMonth">
                    {{ vAddr[date.x][date.y].day }}
                  </span>
                </div>

                <div class="event-container" *ngIf="calendar[vAddr[date.x][date.y].date.strftime('%Y-%m-%d')]">
                  <div class="event">
                    {{ calendar[vAddr[date.x][date.y].date.strftime('%Y-%m-%d')][0].title }}
                  </div>
                  <div class="event" *ngIf="calendar[vAddr[date.x][date.y].date.strftime('%Y-%m-%d')].length > 1">
                    +{{calendar[vAddr[date.x][date.y].date.strftime('%Y-%m-%d')].length - 1}}
                  </div>
                </div>

              </span>
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
  `,
  styleUrls: [
    './infinite-calendar.component.less',
  ]
})
export class InfiniteCalendarComponent implements OnInit, OnChanges, AfterViewInit {

  @ViewChild('scrollView')
  scrollView: ElementRef;


  //
  // Inputs
  //

  @Input()
  height: number = DEFAULT_OPTIONS.style.height;

  @Input()
  navForToday: boolean = DEFAULT_OPTIONS.navigator.today;

  @Input()
  labelForToday: string = DEFAULT_OPTIONS.navigator.labelForToday;

  @Input()
  language: string = DEFAULT_OPTIONS.label.lang;

  @Input()
  shortLabel: boolean = DEFAULT_OPTIONS.label.short;

  @Input()
  dateFormat: string;

  @Input()
  monthDateFormat: string;

  @Input()
  events: InfiniteCalendarEvent[] = [];

  //
  // Outputs
  //

  @Output()
  selectDate: EventEmitter<ExtDateWithEvent> = new EventEmitter<ExtDateWithEvent>();

  @Output()
  hoverOnDate: EventEmitter<ExtDateWithEvent> = new EventEmitter<ExtDateWithEvent>();

  //
  // Configuration
  //
  maxRowsInVirtualContainer = 15;
  maxRowsOnWindow = 5;
  scrollDuration = 400; // msec

  //
  // View Models
  //
  hovering: any;
  selected: any;

  firstCell: any;
  secondCell: any;

  // week labels
  weekLabels: string[] = [];

  // event dictionary
  calendar: any = {};

  // virtual address
  vAddr: any = {};

  // physical address
  pAddr: any[][] = [];

  loadable = false;

  //
  // Models
  //

  // The origin point in virtual space
  origin: ExtDate = new ExtDate();

  // current date object
  currentDate: ExtDate = new ExtDate();
  beginningOnWindow: ExtDate;
  endOnWindow: ExtDate;
  midDayOnCurrentWindow: ExtDate;
  public  firstDate: any;
  public secondDate: any;
  private lastRangeMarkedCells: any[];
  constructor() { }

  ngOnInit() {
    const halfWeeks = Math.floor(this.maxRowsInVirtualContainer / 2.0);
    this.beginningOnWindow = this.currentDate.beginningOfWeek().prevWeek(halfWeeks);
    this.endOnWindow = this.currentDate.endOfWeek().nextWeek(halfWeeks);

    // set origin of virtual address to the beginning of the week of current day
    this.origin = this.currentDate.beginningOfWeek();

    // set week labels
    this._setWeekLabels();

    // calculate the mid day of the current window
    this.midDayOnCurrentWindow = this.currentDate;

    for (let w = 0; w < this.maxRowsInVirtualContainer; w++) {
      this.pAddr.push([]);
      for (let d = 0; d < 7; d++) {
        const date = this.beginningOnWindow.nextDay(7 * w + d);
        const addr = this._calcVirtualAddress(date);
        this.pAddr[w].push(addr);
        this.vAddr[addr.x] = this.vAddr[addr.x] || {};
        this.vAddr[addr.x][addr.y] = {
          date,
          year: date.year(),
          month: date.month(),
          day: date.day(),
          dayOfWeekInShort: date.dayOfWeekInShort('en'),
          current: date.isSameDay(this.currentDate),
          selected: false,
          holiday: date.dayOfWeekInShort('en') === 'Sun',
          firstDayOfMonth: date.day() === 1,
          firstDayOfYear: date.month() === 1 && date.day() === 1
        };
      }
    }
  }

  ngOnChanges() {
    if (!!I18n[this.language]) {
      this._i18n(I18n[this.language]);
    }

    if (this.events && this.events.length > 0) {
      this._initializeEvents();
    }
  }

  ngAfterViewInit() {
    const ele = this.scrollView.nativeElement;
    const initialScrollTop = this.height;
    this._scrollTo(ele, initialScrollTop, this.scrollDuration);
  }

  onClickBackToToday() {
    const y = (-this.pAddr[0][0].y * this.height / this.maxRowsOnWindow);
    this._scrollTo(this.scrollView.nativeElement, y, this.scrollDuration);
  }

  onClickDate(event, addr) {
    if (this.secondDate) { this.secondDate.end = false; }

    this.vAddr[addr.x][addr.y].selected = true;
    if (this.secondDate) {
      this.secondDate.selected = false;
    }
    if (this.firstCell) {
      this.firstDate = this.vAddr[this.firstCell.x][this.firstCell.y];
      this.secondDate = this.vAddr[addr.x][addr.y];
      this.secondCell = addr;
    } else {
      this.firstDate = this.vAddr[addr.x][addr.y];
      this.firstCell = addr;
    }
    if (this.firstCell && this.secondCell) {
      this.markRange();
    }
    if (this.secondDate) { this.secondDate.end = true; }
    this.sendSelectionEvent(addr);
  }

  private markRange() {
    if (this.lastRangeMarkedCells) { this.lastRangeMarkedCells.forEach(c => c.range = false); }
    this.lastRangeMarkedCells = [];
    for (let y = this.firstCell.y; y <= this.secondCell.y; y++ ) {
      if ((this.firstCell.y - y) === 0) {

        if ((this.secondCell.y - this.firstCell.y) === 0) {
          for (let x = this.firstCell.x + 1; x <= this.secondCell.x; x++ ) {
            this.vAddr[x][y].range = true;
            this.lastRangeMarkedCells.push(this.vAddr[x][y]);
          }
        } else {
          for (let x = this.firstCell.x + 1; x <= 6; x++ ) {
            this.vAddr[x][y].range = true;
            this.lastRangeMarkedCells.push(this.vAddr[x][y]);
          }
        }
      } else {
        if ((this.secondCell.y - y) > 0) {
          for (let x = 0; x <= 6; x++ ) {
            this.vAddr[x][y].range = true;
            this.lastRangeMarkedCells.push(this.vAddr[x][y]);
          }
        }
        if ((this.secondCell.y - y) === 0) {
          for (let x = 0; x < this.secondCell.x; x++ ) {
            this.vAddr[x][y].range = true;
            this.lastRangeMarkedCells.push(this.vAddr[x][y]);
          }
        }
      }
    }
  }

  private sendSelectionEvent(addr) {
    const date = this.vAddr[addr.x][addr.y].date;
    const dateWithEvent: ExtDateWithEvent = {
      date,
      events: this.calendar[date.strftime(CALENDAR_KEY_FORMAT)] || []
    };
    this.selectDate.emit(dateWithEvent);
  }

  onMouseoverDate(event, addr) {
    const date = this.vAddr[addr.x][addr.y].date;
    const dateWithEvent: ExtDateWithEvent = {
      date,
      events: this.calendar[date.strftime(CALENDAR_KEY_FORMAT)] || []
    };
    this.hoverOnDate.emit(dateWithEvent);
  }

  onScroll(event) {
    if (!this.loadable) {
      return;
    }

    // load prev month
    if (this.scrollView.nativeElement.scrollTop <= this.height) {
      this._appendMonthToTop();
    }

    // load next month
    //
    // bottom of the current window = this.scrollView.nativeElement.scrollTop + this.height
    // bottom of the next window = this.scrollView.nativeElement.scrollTop + 2 * this.height
    //
    // amount of scrolling = this.scrollView.nativeElement.scrollHeight
    if (this.scrollView.nativeElement.scrollTop + 2 * this.height > this.scrollView.nativeElement.scrollHeight) {
      this._appendMonthToBottom();
    }

    // calculate the first day of the current window
    this.midDayOnCurrentWindow = this._midDayFromScrollTop(this.scrollView.nativeElement.scrollTop, ROW_HEIGHT);
  }

  private _i18n(config) {
    if (this.shortLabel) {
      this.weekLabels = config.short;
    } else {
      this.weekLabels = config.default;
    }

    // date format
    if (config.dateFormat && config.dateFormat.default && !this.dateFormat) {
      this.dateFormat = config.dateFormat.default;
    }
    if (config.dateFormat && config.dateFormat.short && !this.monthDateFormat) {
      this.monthDateFormat = config.dateFormat.short;
    }
  }

  private _initializeEvents() {
    for (const event of this.events) {
      const beginAt = event.beginAt;
      const endAt = event.endAt;
      const interval = new ExtInterval(beginAt, endAt);
      for (let i = 0; i < Math.ceil(interval.asDay()); i++ ) {
        const date = beginAt.nextDay(i);
        const key = date.strftime(CALENDAR_KEY_FORMAT);
        this.calendar[key] = this.calendar[key] || [];

        // calculate order of the event
        if (!event.data.order) {
          let order = 0;
          let eventsOnDay = this.calendar[key];

          // sort events to find a wormhole order
          eventsOnDay = eventsOnDay.sort((a, b) => {
            return a.data.order - b.data.order;
          });

          // find a wormhole
          for (const e of eventsOnDay) {
            if (order !== e.order) {
              break;
            }
            order++;
          }

          event.data.order = order;
        }

        this.calendar[key].push(event);
      }
    }
  }


  private _setWeekLabels() {
    if (this.shortLabel) {
      this.weekLabels = I18n[this.language].dayOfWeek.short;
    } else {
      this.weekLabels = I18n[this.language].dayOfWeek.default;
    }
  }

  private _appendMonthToTop() {
    this.beginningOnWindow = this.beginningOnWindow.prevDay(7 * this.maxRowsOnWindow);
    for (let w = this.maxRowsOnWindow - 1; w >= 0; w--) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = this.beginningOnWindow.nextDay(7 * w + d);
        const addr = this._calcVirtualAddress(date);
        week.push(addr);
        this.vAddr[addr.x] = this.vAddr[addr.x] || {};
        this.vAddr[addr.x][addr.y] = {
          date,
          year: date.year(),
          month: date.month(),
          day: date.day(),
          dayOfWeekInShort: date.dayOfWeekInShort('en'),
          current: date.isSameDay(this.currentDate),
          selected: false,
          holiday: date.dayOfWeekInShort('en') === 'Sun',
          firstDayOfMonth: date.day() === 1,
          firstDayOfYear: date.month() === 1 && date.day() === 1
        };
      }
      this.pAddr = [week].concat(this.pAddr);
    }
  }

  private _appendMonthToBottom() {
    const appendBeginning = this.endOnWindow.nextDay();
    this.endOnWindow = this.endOnWindow.nextDay(7 * this.maxRowsOnWindow);
    for (let w = 0; w < this.maxRowsOnWindow ; w++) {
      const week = [];
      for (let d = 0; d < 7; d++) {
        const date = appendBeginning.nextDay(7 * w + d);
        const addr = this._calcVirtualAddress(date);
        week.push(addr);
        this.vAddr[addr.x] = this.vAddr[addr.x] || {};
        this.vAddr[addr.x][addr.y] = {
          date,
          year: date.year(),
          month: date.month(),
          day: date.day(),
          dayOfWeekInShort: date.dayOfWeekInShort('en'),
          current: date.isSameDay(this.currentDate),
          selected: false,
          holiday: date.dayOfWeekInShort('en') === 'Sun',
          firstDayOfMonth: date.day() === 1,
          firstDayOfYear: date.month() === 1 && date.day() === 1
        };
      }
      this.pAddr = this.pAddr.concat([week]);
    }
  }

  private _midDayFromScrollTop(scrollTop: number, rowHeight: number): ExtDate {
    const weeks = Math.floor(scrollTop / rowHeight);
    const target = this.beginningOnWindow.nextWeek(weeks + 2).nextDay(3);
    return target;
  }

  private _calcVirtualAddress(date: ExtDate) {
    const interval = new ExtInterval(this.origin, date);
    const days = Math.floor(interval.asDay());
    if (days >= 0) {
      return {
        x: days % 7,
        y: Math.floor(days / 7.0)
      };
    } else {
      return {
        x: 6 - ((-days - 1) % 7),
        y: Math.floor((7 + days) / 7.0) - 1,
      };
    }
  }

  private _scrollTo(element, offsetTop: number, duration: number) {
    const fps = 60.0; // frame per sec

    const initOffsetTop: number = element.scrollTop;

    let counter = 0;
    const interval = setInterval(() => {
      if (counter * 1000 >= duration * fps) {
        clearInterval(interval);
      }

      const easingFunction = this._easing('quodratic');
      const time = counter * 1000 / (fps * duration);

      const scrollTop = initOffsetTop + (offsetTop - initOffsetTop) * easingFunction(time);
      element.scrollTop = scrollTop;

      counter += 1;
    }, Math.round(1000.0 / fps));

    // setInterval will not be finished exact duration time
    const error = 400; // msec

    // disable to load dates while auto scrolling
    setTimeout(() => {
      this.loadable = true;
    }, duration + error);
  }

  private _easing(pattern: string) {
    switch (pattern) {
      case 'quodratic':
        return (time: number) => time < .5 ? 2 * time * time : -2 * (time - 1) * (time - 1) + 1;
      default:
        return (time: number) => time < .5 ? 2 * time * time : -2 * (time - 1) * (time - 1) + 1;
    }
  }


}
