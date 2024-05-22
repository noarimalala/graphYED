import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { GraphComponentComponent } from './graph-component/graph-component.component';
import { PropertiesViewComponent } from './properties-view/properties-view.component';
import { TooltipComponent } from './tooltip/tooltip.component';
import { FormsModule } from '@angular/forms';
import { NodeComponent } from './node.component';
import { ContextMenuComponent } from './context-menu/context-menu.component';

@NgModule({
  declarations: [
    AppComponent,
    GraphComponentComponent,
    PropertiesViewComponent,
    TooltipComponent,
    NodeComponent,
    ContextMenuComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
