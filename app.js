const express = require('express')
const path = require('path')
const sqlite3 = require('sqlite3')
const {open} = require('sqlite')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcrypt')
const app = express()
app.use(express.json())
let db
const dbPath = path.join(__dirname, 'twitterClone.db')

const initiliseDataRequest = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () => {
      console.log('Server Running On 3000/ Port..')
    })
  } catch (e) {
    console.log(`ERROR OF ${e.message}`)
    process.exit(1)
  }
}
initiliseDataRequest()

const authorizationMid = async (request, response, next) => {
  const {tweet} = request.body
  const {tweetId} = request.params
  let jwtTokenKey
  const accessKey = request.headers['authorization']
  if (accessKey !== undefined) {
    jwtTokenKey = accessKey.split(' ')[1]
  }
  if (accessKey === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtTokenKey, 'SAI_KRISHNA_9010', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        request.payload = payload
        request.tweet = tweet
        request.tweetId = tweetId
        next()
      }
    })
  }
}
const passwordValidCheck = passwordLenght => {
  return passwordLenght.length < 6
}

app.post('/register/', async (request, response) => {
  const {name, username, password, gender} = request.body
  const postSqlGetData = `
    SELECT * FROM user WHERE username = '${username}' ;  `
  const userNamedata = await db.get(postSqlGetData)
  if (userNamedata !== undefined) {
    response.status(400)
    response.send('User already exists')
  } else {
    if (passwordValidCheck(password)) {
      response.status(400)
      response.send('Password is too short')
    } else {
      const hashPassward = await bcrypt.hash(password, 10)
      const registeringUser = `
        INSERT INTO user(  name, username, password, gender )
          VALUES(
            '${name}', '${username}', "${hashPassward}", "${gender}"
          )`
      await db.run(registeringUser)
      response.status(200)
      response.send('User created successfully')
    }
  }
})

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const userLogin = `SELECT * FROM user WHERE username = "${username}" ; `
  const userLogResponse = await db.get(userLogin)
  if (userLogResponse === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const comparePassward = await bcrypt.compare(
      password,
      userLogResponse.password,
    )
    if (comparePassward) {
      // let payload = {username: username}
      const jwtToken = jwt.sign(userLogResponse, 'SAI_KRISHNA_9010')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/user/tweets/feed/', authorizationMid, async (request, response) => {
  const {payload} = request
  const {user_id} = payload
  const sqlGetFeed = `
  SELECT username ,
        tweet , 
        date_time as dateTime
  FROM
    follower inner join
      tweet on follower.following_user_id = tweet.user_id inner join user  on
      user.user_id = tweet.user_id  inner join user on
      user.user_id = follower.following_user_id
    where
      follower.follower_user_id = ${user_id}
    order by dateTime DESC
    LIMIT 4 ;`
  const tweetResponse = await db.all(sqlGetFeed)
  response.send(tweetResponse)
})

//API 4

app.get('/user/following/', authorizationMid, async (request, response) => {
  const {payload} = request
  const {user_id} = payload
  const sqlGetFollowing = `
    SELECT name FROM user INNER JOIN follower on
      user.user_id = follower.following_user_id
    where follower.follower_user_id= ${user_id} `
  const getSqlOfFollowing = await db.all(sqlGetFollowing)
  response.send(getSqlOfFollowing)
})

//API 5

app.get('/user/followers/', authorizationMid, async (request, response) => {
  const {payload} = request
  const {user_id} = payload
  const sqlGetFollower = `
    SELECT name FROM user INNER JOIN follower on
      user.user_id = follower.follower_user_id
    where follower.following_user_id= ${user_id}`
  const getSqlOfFollower = await db.all(sqlGetFollower)
  response.send(getSqlOfFollower)
})

// API 6

app.get('/tweets/:tweetId/', authorizationMid, async (request, response) => {
  const {tweetId} = request
  const {payload} = request
  const {user_id} = payload
  const sqlGetTweetById = `
    SELECT * FROM tweet where tweet_id = ${tweetId} `
  const getTweetResult = await db.get(sqlGetTweetById)
  const getTweetOfUser = `
    SELECT * FROM follower inner join user on user.user_id = follower.following_user_id
    where  follower.follower_user_id = ${user_id}  ;`
  const userFollower = await db.all(getTweetOfUser)
  if (
    userFollower.some(item => item.following_user_id === getTweetResult.user_id)
  ) {
    const getTweetDetailesQuery = `
    select tweet , count(DISTINCT(like.like_id)) as likes ,
    count(DISTINCT(reply.reply_id)) as replies,
    tweet.date_time as dateTime
    FROM 
    tweet INNER JOIN like on tweet.tweet_id = like.tweet_id inner join reply on reply.tweet_id = tweet.tweet_id
    WHERE 
    tweet.tweet_id = ${tweetId} AND tweet.user_id = ${userFollower[0].user_id} ;`
    const tweetDetails = await db.get(getTweetDetailesQuery)
    response.send(tweetDetails)
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})

// API 7

app.get(
  '/tweets/:tweetId/likes/',
  authorizationMid,
  async (request, response) => {
    const {tweetId} = request
    const {payload} = request
    const {user_id} = payload
    const getLikedUserQuery = `
      SELECT *  FROM 
        follower INNER JOIN tweet on tweet.user_id = follower.following_user_id inner join like on like.tweet_id = tweet.tweet_id
        inner join user on user.user_id = like.user_id
      where
      tweet.tweet_id  = ${tweetId} AND follower.following_user_id =  ${user_id}`
    const likedUsers = await db.all(getLikedUserQuery)
    if (likedUsers.length !== 0) {
      let likes = []
      const getNamesArray = likedUsers => {
        for (let item of likedUsers) {
          likes.push(item.username)
        }
      }
      getNamesArray(likedUsers)
      response.send({likes})
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)

app.get(
  '/tweets/:tweetId/replies/',
  authorizationMid,
  async (request, response) => {
    const {tweetId} = request
    const {payload} = request
    const {user_id} = payload
    const getRepliesUsersQuery = `
      SELECT *
      FROM follower INNER JOIN tweet ON tweet.user_id = follower.following_user_id inner join reply on reply.tweet_id = tweet.tweet_id
      inner join user ON user.user_id = reply.user_id
      where
      tweet.tweet_id = ${tweetId} AND follower.follower_user_id = ${user_id}`
    const repliedUsers = await db.all(getRepliesUsersQuery)
    if (repliedUsers.length !== 0) {
      let replies = []
      const getNamesArray = repliedUsers => {
        for (let item of repliedUsers) {
          let object = {
            name: item.name,
            reply: item.reply,
          }
          replies.push(object)
        }
      }
      getNamesArray(repliedUsers)
      response.send({replies})
    } else {
      response.status(401)
      response.send('Invalid Request')
    }
  },
)
//API 9
app.get('/user/tweets/', authorizationMid, async (request, response) => {
  const {payload} = request
  const {user_id} = payload
  const getTweetsDetailesQuery = `
    SELECT tweet.tweet as tweet ,
    count(DISTINCT(like.like_id)) as likes ,
    count(DISTINCT(reply.reply_id)) as replies,
  FROM 
    user INNER JOIN tweet on user.user_id = tweet.user_id inner join like on like.tweet_id = tweet.tweet_id inner join reply on reply.tweet_id = tweet.tweet_id
    WHERE 
    user.user_id = ${user_id}
  group by
    tweet.tweet_id ; `
  const tweetsDetails = await db.all(getTweetsDetailesQuery)
  response.send(tweetsDetails)
})

//API 10

app.post('/user/tweets', authorizationMid, async (request, response) => {
  const {tweetId} = request
  const {tweet} = request
  const {payload} = request
  const {user_id} = payload
  const postTweetQuery = `
    INSERT INTO 
      tweet (tweet , user_id)
    VALUES(
      "${tweet}",
      ${user_id}
    ); `
  await db.run(postTweetQuery)
  response.send('Created a Tweet')
})

app.delete('/tweets/:tweetId', authorizationMid, async (request, response) => {
  const {tweetId} = request
  const {payload} = request
  const {user_id} = payload
  const selectUserQuery = `SELECT  * FROM  tweet where tweet.user_id = ${user_id} and tweet.tweet_id =${tweetId} `
  const tweetUser = await db.all(selectUserQuery)
  if (tweetUser.length !== 0) {
    const deleteTweetQuery = `
      DELETE FROM tweet
        where 
        tweet.user_id =${user_id} AND tweet.tweet_id =${tweetId};  `
    await db.run(deleteTweetQuery)
    response.send('Tweet Removed')
  } else {
    response.status(401)
    response.send('Invalid Request')
  }
})
module.exports = app
