import { Component } from '@angular/core';
import { FractalComponent } from './fractal/fractal.component';

@Component({
  selector: 'app-root',
  imports: [FractalComponent],
  template: '<app-fractal />',
})
export class App {}
