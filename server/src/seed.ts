import type { SeedData } from "./types.js";

/** Fictional example people and posts. Nothing here is a real person. */
export function seedData(): SeedData {
  return {
    users: [
      { id: "user_1", handle: "maya", displayName: "Maya Chen" },
      { id: "user_2", handle: "noah", displayName: "Noah Patel" },
      { id: "user_3", handle: "luca", displayName: "Luca Rossi" },
      { id: "user_4", handle: "priya", displayName: "Priya Nair" },
      { id: "user_5", handle: "elena", displayName: "Elena Vogt" },
    ],
    posts: [
      {
        id: "post_1",
        authorId: "user_1",
        body: "The Saturday market had the best oranges I have had all year. There was also a typography stall, which I did not expect.",
        createdAt: "2026-11-18T09:15:00.000Z",
      },
      {
        id: "post_2",
        authorId: "user_2",
        body: "Refactored a messy module by writing the tests first. Slower to start, much faster to finish.",
        createdAt: "2026-11-18T14:40:00.000Z",
      },
      {
        id: "post_3",
        authorId: "user_3",
        body: "Looking for a quiet walking route near the river this weekend. Suggestions welcome.",
        createdAt: "2026-11-19T08:05:00.000Z",
      },
      {
        id: "post_4",
        authorId: "user_1",
        body: "Coffee note: a slightly darker roast, short pour, less bitterness than yesterday.",
        createdAt: "2026-11-19T16:22:00.000Z",
      },
      {
        id: "post_5",
        authorId: "user_4",
        body: "Finished a paperback on the train and started the next one before I got home.",
        createdAt: "2026-11-20T11:10:00.000Z",
      },
      {
        id: "post_6",
        authorId: "user_5",
        body: "Tried a new pasta shape tonight. The sauce clung better than I thought it would.",
        createdAt: "2026-11-21T18:45:00.000Z",
      },
      {
        id: "post_7",
        authorId: "user_2",
        body: "Desktop speakers finally replaced the laptop tin. Small change, big difference.",
        createdAt: "2026-11-22T10:30:00.000Z",
      },
      {
        id: "post_8",
        authorId: "user_4",
        body: "A grey morning, a long walk, and a warm bakery at the end of it. That is a good plan.",
        createdAt: "2026-11-23T09:00:00.000Z",
      },
    ],
    comments: [
      {
        id: "comment_1",
        postId: "post_1",
        authorId: "user_3",
        body: "I know that stall. They had a poster about spacing that I still think about.",
        createdAt: "2026-11-18T10:02:00.000Z",
      },
      {
        id: "comment_2",
        postId: "post_3",
        authorId: "user_5",
        body: "Try the path on the north bank, starting at the old bridge. It stays quiet until noon.",
        createdAt: "2026-11-19T08:40:00.000Z",
      },
      {
        id: "comment_3",
        postId: "post_3",
        authorId: "user_1",
        body: "Seconding the north bank. Take a jacket, the wind picks up near the water.",
        createdAt: "2026-11-19T09:11:00.000Z",
      },
      {
        id: "comment_4",
        postId: "post_6",
        authorId: "user_2",
        body: "Which shape was it? I have been looking for one that holds a thicker sauce.",
        createdAt: "2026-11-21T19:05:00.000Z",
      },
      {
        id: "comment_5",
        postId: "post_8",
        authorId: "user_5",
        body: "That sounds like the right kind of morning.",
        createdAt: "2026-11-23T09:28:00.000Z",
      },
    ],
    likes: [
      { id: "like_1", postId: "post_1", userId: "user_2", createdAt: "2026-11-18T09:30:00.000Z" },
      { id: "like_2", postId: "post_1", userId: "user_4", createdAt: "2026-11-18T11:00:00.000Z" },
      { id: "like_3", postId: "post_2", userId: "user_1", createdAt: "2026-11-18T15:10:00.000Z" },
      { id: "like_4", postId: "post_3", userId: "user_4", createdAt: "2026-11-19T08:20:00.000Z" },
      { id: "like_5", postId: "post_6", userId: "user_1", createdAt: "2026-11-21T19:00:00.000Z" },
      { id: "like_6", postId: "post_8", userId: "user_1", createdAt: "2026-11-23T09:12:00.000Z" },
      { id: "like_7", postId: "post_8", userId: "user_3", createdAt: "2026-11-23T09:40:00.000Z" },
    ],
  };
}
