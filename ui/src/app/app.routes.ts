import { Routes } from '@angular/router';
import { DashboardPage } from './pages/dashboard.page';
import { EventPage } from './pages/event.page';
import { BipsPage } from './pages/bips.page';
import { ClockPage } from './pages/clock.page';
import { TasksPage } from './pages/tasks.page';
import { ChangedPage } from './pages/changed.page';
import { LoginPage } from './pages/login.page';
import { FeedsPage } from './pages/feeds.page';

export const routes: Routes = [
  { path: '', component: DashboardPage },
  { path: 'login', component: LoginPage },
  { path: 'events/:id', component: EventPage },
  { path: 'bips', component: BipsPage },
  { path: 'clock', component: ClockPage },
  { path: 'tasks', component: TasksPage },
  { path: 'feeds', component: FeedsPage },
  { path: 'changed', component: ChangedPage },
];
