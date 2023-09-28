const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
let db = null;
const jwt = require("jsonwebtoken");
app.use(express.json());
const intiliazeDbAndServer = async () => {
  try {
    db = await open({
      filename: path.join(__dirname, "twitterClone.db"),
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Started");
    });
  } catch (e) {
    console.log("Error");
  }
};
const authenticate = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_TOKEN", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        request.userId = payload.userId;
        next();
      }
    });
  }
};
const tweetAccess = async (request, response, next) => {
  const { tweetId } = request.params;
  const { userId } = request;
  const query1 = `select * from follower inner join tweet 
    on follower.following_user_id=tweet.user_id
    where tweet.tweet_id='${tweetId}' and follower_user_id='${userId}';`;
  const dbResponse = await db.get(query1);
  if (dbResponse === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    next();
  }
};
const getFollowingIdsFunction = async (username) => {
  const getIds = `select following_user_id from user inner join follower
    on user.user_id=follower.follower_user_id where user.username='${username}';`;
  const dbGetIds = await db.all(getIds);
  const arrayIds = dbGetIds.map((eachItem) => eachItem.following_user_id);
  console.log(arrayIds);
  return arrayIds;
};
const validateUser = async (request, response, next) => {
  const { tweetId } = request.params;
  const { userId } = request;
  const query5 = `select * from tweet  where  tweet_id='${tweetId}'
    and user_id='${userId}';`;
  const dbResponse5 = await db.get(query5);
  if (dbResponse5 == undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    next();
  }
};
app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const checkName = `select * from user where username='${username}';`;
  const dbCheckName = await db.get(checkName);
  if (dbCheckName != undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const passwordHash = await bcrypt.hash(password, 10);
      const registerUser = `insert into user
        (username,name,password,gender)values
        ('${username}','${name}','${passwordHash}','${gender}');`;
      const dbResisterUser = await db.run(registerUser);
      response.status(200);
      response.send("User created successfully");
    }
  }
});
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const query2 = `select * from user where username='${username}';`;
  const dbResponse2 = await db.get(query2);

  if (dbResponse2 === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatch = await bcrypt.compare(
      password,
      dbResponse2.password
    );
    if (isPasswordMatch === true) {
      const payload = { username: username, userId: dbResponse2.user_id };
      const jwtToken = jwt.sign(payload, "MY_TOKEN");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});
app.get("/user/tweets/feed/", authenticate, async (request, response) => {
  const { username } = request;
  const getFollowingIdsQuery = await getFollowingIdsFunction(username);
  const tweets = `select username,tweet,date_time as dateTime 
 from user inner join tweet on user.user_id=tweet.user_id 
 where user.user_id in (${getFollowingIdsQuery})
 order by date_time desc limit 4;`;
  const dbTweets = await db.all(tweets);
  response.send(dbTweets);
});
app.get("/user/following/", authenticate, async (request, response) => {
  const { username, userId } = request;
  const getNames = `select name from user inner join follower
    on user.user_id=follower.following_user_id
    where follower_user_id='${userId}';`;
  const dbGetNames = await db.all(getNames);
  response.send(dbGetNames);
});
app.get("/user/followers/", authenticate, async (request, response) => {
  const { username, userId } = request;
  const getNames = `select name from user inner join follower
    on user.user_id=follower.follower_user_id
    where following_user_id='${userId}';`;
  const dbGetNames = await db.all(getNames);
  response.send(dbGetNames);
});
app.get(
  "/tweets/:tweetId/",
  authenticate,
  tweetAccess,
  async (request, response) => {
    const { username, userId } = request;
    const { tweetId } = request.params;
    const query2 = `select tweet ,
    (select count() from like where tweet_id='${tweetId}')as likes,
     (select count() from reply where tweet_id='${tweetId}')as replies,
     date_time as dateTime from tweet where tweet_id='${tweetId}';`;
    const dbResponse3 = await db.get(query2);
    response.send(dbResponse3);
  }
);
app.get(
  "/tweets/:tweetId/likes/",
  authenticate,
  tweetAccess,
  async (request, response) => {
    const { username, userId } = request;
    const { tweetId } = request.params;
    const query4 = `select username from user inner join like 
    on user.user_id=like.user_id where tweet_id='${tweetId}';`;
    const dbResponse4 = await db.all(query4);
    const userArrays = dbResponse4.map((eachItem) => eachItem.username);
    response.send({ likes: userArrays });
  }
);
app.get(
  "/tweets/:tweetId/replies/",
  authenticate,
  tweetAccess,
  async (request, response) => {
    const { tweetId } = request.params;
    const query5 = `select name,reply from user join reply 
      on user.user_id=reply.user_id
      where tweet_id='${tweetId}';`;
    const dbResponse5 = await db.all(query5);
    response.send({ replies: dbResponse5 });
  }
);
app.get("/user/tweets/", authenticate, async (request, response) => {
  const { tweetId } = request.params;
  const { userId } = request;
  const query55 = `select tweet,
    count(distinct like_id) as likes,
    count(distinct reply_id) as replies,
    date_time as dateTime from tweet left  join reply on tweet.tweet_id =reply.tweet_id
    left join like on tweet.tweet_id=like.tweet_id
    where tweet.user_id='${userId}'
    group by tweet.tweet_id;`;
  const tweets = await db.all(query55);
  response.send(tweets);
});
app.post("/user/tweets", authenticate, async (request, response) => {
  const { tweet } = request.body;
  const { userId } = request;
  const date_time = new Date();
  const query5 = `insert into tweet(tweet,user_id,date_time)values(
      '${tweet}',${userId},'${date_time}');`;
  const dbResponse = await db.run(query5);
  response.send("Created a Tweet");
});
app.delete(
  "/tweets/:tweetId/",
  authenticate,
  validateUser,
  async (request, response) => {
    const { tweetId } = request.params;
    const { userId } = request;
    const query6 = `delete from tweet where tweet_id='${tweetId}';`;
    await db.run(query6);
    response.send("Tweet Removed");
  }
);
intiliazeDbAndServer();
module.exports = app;
