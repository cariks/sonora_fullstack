import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { AuthPageComponent } from './pages/auth-page/auth-page.component';


import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import { MainLayoutComponent } from './layout/main-layout/main-layout.component';
import { SidebarComponent } from './layout/sidebar/sidebar.component';
import { PlayerComponent } from './layout/player/player.component';
import { HomeComponent } from './pages/home/home.component';
import { HeaderComponent } from './layout/header/header.component';
import { LikedSongsComponent } from './pages/liked-songs/liked-songs.component';
import { PlaylistsComponent } from './pages/playlists/playlists.component';
import { UploadComponent } from './pages/upload/upload.component';
import { MySongsComponent } from './pages/my-songs/my-songs.component';
import { SettingsComponent } from './pages/settings/settings.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { UserProfileComponent } from './pages/user-profile/user-profile.component';
import { ImageSequenceComponent } from './components/image-sequence/image-sequence.component';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import {ProfileAvatarComponent} from "./shared/profile-avatar/profile-avatar.component";
import {CommonModule} from "@angular/common";
import {PlaylistModalComponent} from "./shared/playlist-modal/playlist-modal.component";
import {AddToPlaylistModalComponent} from "./shared/components/add-to-playlist-modal/add-to-playlist-modal.component";
import {
  PlaylistOptionsModalComponent
} from "./shared/components/playlist-options-modal/playlist-options-modal.component";



@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    MainLayoutComponent,
    SidebarComponent,
    PlayerComponent,
    HomeComponent,
    HeaderComponent,
    LikedSongsComponent,
    PlaylistsComponent,
    UploadComponent,
    MySongsComponent,
    SettingsComponent,
    UserProfileComponent,
    ImageSequenceComponent,
    RegisterComponent,
    AuthPageComponent,

  ],
  imports: [
    CommonModule,
    BrowserModule,
    AppRoutingModule,
    HttpClientModule,
    FormsModule,
    BrowserAnimationsModule,
    MatSlideToggleModule,
    ReactiveFormsModule,
    ProfileAvatarComponent,
    PlaylistModalComponent,
    AddToPlaylistModalComponent,
    PlaylistOptionsModalComponent,


  ],
  providers: [
    {
    provide: HTTP_INTERCEPTORS,
    useClass: AuthInterceptor,
    multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
