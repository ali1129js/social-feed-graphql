export interface GqlUser {
  id: string;
  handle: string;
  displayName: string;
}

export interface GqlComment {
  id: string;
  body: string;
  createdAt: string;
  postId: string;
  author: GqlUser;
}

export interface GqlLike {
  id: string;
  createdAt: string;
  postId: string;
  user: GqlUser;
}

export interface GqlPost {
  id: string;
  body: string;
  createdAt: string;
  author: GqlUser;
  comments: GqlComment[];
  likes: GqlLike[];
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

export interface GqlPageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface GqlFeedConnection {
  edges: Array<{ cursor: string; node: GqlPost }>;
  pageInfo: GqlPageInfo;
  totalCount: number;
}

export interface FeedQueryData {
  feed: GqlFeedConnection;
}

export interface FeedQueryVars {
  first?: number;
  after?: string;
}

export interface UsersQueryData {
  users: GqlUser[];
}

export interface MeQueryData {
  me: GqlUser | null;
}

export interface SignInMutationData {
  signIn: { token: string; user: GqlUser };
}

export interface SignInMutationVars {
  handle: string;
}

export interface CreatePostMutationData {
  createPost: GqlPost;
}

export interface CreatePostMutationVars {
  body: string;
}

export interface CommentMutationData {
  comment: GqlComment;
}

export interface CommentMutationVars {
  postId: string;
  body: string;
}

export interface LikeMutationData {
  like: GqlPost;
}

export interface LikeMutationVars {
  postId: string;
}

export interface DeletePostMutationData {
  deletePost: boolean;
}

export interface DeletePostMutationVars {
  postId: string;
}

export interface DeleteCommentMutationData {
  deleteComment: boolean;
}

export interface DeleteCommentMutationVars {
  commentId: string;
}
