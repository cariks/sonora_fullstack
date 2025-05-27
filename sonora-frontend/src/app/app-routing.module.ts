import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { HomeComponent } from './pages/home/home.component';
import { LikedSongsComponent } from './pages/liked-songs/liked-songs.component';
import { PlaylistsComponent } from './pages/playlists/playlists.component';
import { UploadComponent } from './pages/upload/upload.component';
import { MySongsComponent } from './pages/my-songs/my-songs.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { AuthGuard } from './guards/auth.guard';
import { UserProfileComponent } from './pages/user-profile/user-profile.component';
import {AuthPageComponent} from "./pages/auth-page/auth-page.component";

const routes: Routes = [
  {
    "path": '',
    "component": MainLayoutComponent,
    canActivate: [AuthGuard],
    "children": [
      { "path": '', "component": HomeComponent },
      { "path": 'liked', "component": LikedSongsComponent },
      { "path": 'playlists', "component": PlaylistsComponent },
      { "path": 'upload', "component": UploadComponent },
      { "path": 'my-songs', "component": MySongsComponent },
      { "path": 'settings', "component": SettingsComponent },
      { "path": 'user/:username', "component": UserProfileComponent }
    ]
  },
  { path: 'auth-page', component: AuthPageComponent },
  { path: '**', redirectTo: '' }
];



@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
