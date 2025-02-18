import { createCookieSessionStorage } from "react-router";

type SessionData = {
  userId: string;
  roomId: string;
};

type SessionFlashData = {
  error: string;
};

const { getSession, commitSession, destroySession } =
  createCookieSessionStorage<SessionData, SessionFlashData>({
    cookie: {
      name: "__session",
      httpOnly: true,
      path: "/",
      secrets: ["s3cre1"],
    },
  });

export { getSession, commitSession, destroySession };
