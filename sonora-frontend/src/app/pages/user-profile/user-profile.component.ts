import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent implements OnInit {
  profileUser: any;
  username: string = '';

  constructor(private route: ActivatedRoute, private http: HttpClient) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const username = params['username'];
      this.http.get(`http://localhost:8000/api/users/${username}`).subscribe({
        next: (res) => this.profileUser = res
      });
    });
  }

  loadUser() {
    this.http.get(`http://localhost:8000/api/users/${this.username}`)
      .subscribe({
        next: (res) => this.profileUser = res,
        error: (err) => console.error('User not found', err)
      });
  }
}
