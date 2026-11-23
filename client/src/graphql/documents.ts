import { gql, type TypedDocumentNode } from "urql";
import type {
  CommentMutationData,
  CommentMutationVars,
  CreatePostMutationData,
  CreatePostMutationVars,
  DeleteCommentMutationData,
  DeleteCommentMutationVars,
  DeletePostMutationData,
  DeletePostMutationVars,
  FeedQueryData,
  FeedQueryVars,
  LikeMutationData,
  LikeMutationVars,
  MeQueryData,
  SignInMutationData,
  SignInMutationVars,
  UsersQueryData,
} from "./types";

const POST_FIELDS = gql`
  fragment PostFields on Post {
    id
    body
    createdAt
    likeCount
    commentCount
    likedByMe
    author {
      id
      handle
      displayName
    }
    comments {
      id
      body
      createdAt
      postId
      author {
        id
        handle
        displayName
      }
    }
    likes {
      id
      createdAt
      postId
      user {
        id
        handle
        displayName
      }
    }
  }
`;

export const FEED_QUERY: TypedDocumentNode<FeedQueryData, FeedQueryVars> = gql`
  query Feed($first: Int, $after: String) {
    feed(first: $first, after: $after) {
      totalCount
      pageInfo {
        hasNextPage
        hasPreviousPage
        startCursor
        endCursor
      }
      edges {
        cursor
        node {
          ...PostFields
        }
      }
    }
  }
  ${POST_FIELDS}
`;

export const USERS_QUERY: TypedDocumentNode<UsersQueryData, Record<string, never>> = gql`
  query Users {
    users {
      id
      handle
      displayName
    }
  }
`;

export const ME_QUERY: TypedDocumentNode<MeQueryData, Record<string, never>> = gql`
  query Me {
    me {
      id
      handle
      displayName
    }
  }
`;

export const SIGN_IN_MUTATION: TypedDocumentNode<SignInMutationData, SignInMutationVars> = gql`
  mutation SignIn($handle: String!) {
    signIn(handle: $handle) {
      token
      user {
        id
        handle
        displayName
      }
    }
  }
`;

export const CREATE_POST_MUTATION: TypedDocumentNode<CreatePostMutationData, CreatePostMutationVars> = gql`
  mutation CreatePost($body: String!) {
    createPost(body: $body) {
      ...PostFields
    }
  }
  ${POST_FIELDS}
`;

export const COMMENT_MUTATION: TypedDocumentNode<CommentMutationData, CommentMutationVars> = gql`
  mutation Comment($postId: ID!, $body: String!) {
    comment(postId: $postId, body: $body) {
      id
      body
      createdAt
      postId
      author {
        id
        handle
        displayName
      }
    }
  }
`;

export const LIKE_MUTATION: TypedDocumentNode<LikeMutationData, LikeMutationVars> = gql`
  mutation Like($postId: ID!) {
    like(postId: $postId) {
      ...PostFields
    }
  }
  ${POST_FIELDS}
`;

export const DELETE_POST_MUTATION: TypedDocumentNode<DeletePostMutationData, DeletePostMutationVars> = gql`
  mutation DeletePost($postId: ID!) {
    deletePost(postId: $postId)
  }
`;

export const DELETE_COMMENT_MUTATION: TypedDocumentNode<
  DeleteCommentMutationData,
  DeleteCommentMutationVars
> = gql`
  mutation DeleteComment($commentId: ID!) {
    deleteComment(commentId: $commentId)
  }
`;
