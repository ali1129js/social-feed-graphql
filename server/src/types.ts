export interface UserRecord {
  id: string;
  handle: string;
  displayName: string;
}

export interface PostRecord {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface CommentRecord {
  id: string;
  postId: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface LikeRecord {
  id: string;
  postId: string;
  userId: string;
  createdAt: string;
}

export interface SeedData {
  users: UserRecord[];
  posts: PostRecord[];
  comments: CommentRecord[];
  likes: LikeRecord[];
}
