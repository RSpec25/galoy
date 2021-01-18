const twilio = require('twilio');
import moment from "moment"
import { PhoneCode, User } from "./mongodb";

import { randomIntFromInterval, createToken, LoggedError } from "./utils"

const projectName = "***REMOVED*** Wallet"

const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER
const getTwilioClient = () => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const apiKey = process.env.TWILIO_API_KEY
  const apiSecret = process.env.TWILIO_API_SECRET

  const client = twilio(apiKey, apiSecret, { accountSid });
  return client
}

export const sendText = async ({ body, to }) => {
  await getTwilioClient().messages.create({
    from: twilioPhoneNumber,
    to,
    body,
  })
}

export const TEST_NUMBER = [
  { phone: "+16505554321", code: 321321, currency: "BTC" },
  { phone: "+16505554322", code: 321321, currency: "BTC" },
  { phone: "+16505554323", code: 321321, currency: "BTC" },
  { phone: "+16505554324", code: 321321, currency: "BTC" },
  { phone: "+16505554325", code: 321321, currency: "BTC", username: "***REMOVED***" }, // funder
  
  { phone: "+16505554326", code: 321321, currency: "USD" }, // usd
  { phone: "+16505554326", code: 321321, currency: "BTC" }, // btc
  
  { phone: "+16505554327", code: 321321, currency: "BTC" }, // broker
  { phone: "+16505554328", code: 321321, currency: "BTC" }, // 
  { phone: "+16505554329", code: 321321, currency: "BTC" }, // postman
  { phone: "+16505554330", code: 321321, currency: "USD" }, // usd bis

  { phone: "+***REMOVED***", code: 321321, currency: "BTC" }, // for manual testing
]

export const requestPhoneCode = async ({ phone, logger }) => {

  // make it possible to bypass the auth for testing purpose
  if (TEST_NUMBER.findIndex(item => item.phone === phone) !== -1) {
    return true
  }

  const code = randomIntFromInterval(100000, 999999)
  const body = `${code} is your verification code for ${projectName}`

  try {
    // TODO: implement backoff strategy instead this native delay
    // making sure someone can not call the API thousands time in a row,
    // which would make finding a code very easy
    const veryRecentCode = await PhoneCode.findOne({
      phone,
      created_at: {
        $gte: moment().subtract(30, "seconds"),
      }
    })

    if (!!veryRecentCode) {
      return false
    }

    await PhoneCode.create({ phone, code })
    await sendText({ body, to: phone })
  } catch (err) {
    logger.error({err}, "impossible to send message")
    return false
  }

  return true
}

interface ILogin {
  phone: string
  code: number
  currency?: string
  logger: any
}

export const login = async ({ phone, code, currency = "BTC", logger }: ILogin) => {
  const subLogger = logger.child({topic: "login"})

  // TODO: not sure if graphql return null or undefined when a field is not passed
  // adding this as an early catch for now
  if (!currency) {
    const err = `currency is not set. exiting login()`
    subLogger.error({currency, phone}, err)
    throw new LoggedError(err)
  }

  try {
    // TODO: rate limit this method per phone with backoff
    const codes = await PhoneCode.find({
      phone,
      created_at: {
        $gte: moment().subtract(20, "minutes"),
      }
    })

    // is it a test account?
    if (TEST_NUMBER.findIndex(item => item.phone === phone) !== -1 &&
      TEST_NUMBER.filter(item => item.phone === phone)[0].code === code) {
      // we are in this branch if phone is a test account + code is correct
    } else if (codes.findIndex(item => item.code === code) === -1) {
      // this branch is both relevant for test and non-test accounts
      // for when the code is not correct
      subLogger.warn({ phone, code }, `user enter incorrect code`)
      return null
    }

    // code is correct
    
    // get User 
    let user

    user = await User.findOne({ phone, currency })

    if (user) {
      subLogger.info({ phone, currency }, "user logged in")
    } else {
      user = await User.findOneAndUpdate({ phone, currency }, {}, { upsert: true, new: true })
      subLogger.info({ phone, currency } , "a new user has register")
    }

    const network = process.env.NETWORK
    return createToken({ uid: user._id, currency, network })
    
  } catch (err) {
    subLogger.error({err})
    throw err
  }
}
