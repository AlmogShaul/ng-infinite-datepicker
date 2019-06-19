import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import {InfiniteCalendarModule} from './infinit-calendar';

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    InfiniteCalendarModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
