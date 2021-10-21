import { put, select } from 'redux-saga/effects'

import { actions, selectors } from 'data'
import * as C from 'services/alerts'

import {
  AccountUnificationFlows,
  LoginSteps,
  PlatformTypes,
  ProductAuthOptions,
  UserType
} from './types'

const logLocation = 'auth/sagas'

// TEST JSON FOR MOBILE WEBVIEW BEINGS PASSED TO WALLET
const testMagicLinkData = {
  exchange: {
    email: 'leora+235+1002@blockchain.com',
    user_id: 'ed005bec-1ced-4fc0-95ea-0d6f75ecae10'
  },
  mergeable: true,
  product: ProductAuthOptions.WALLET,
  unified: false,
  upgradeable: null,
  user_type: UserType.WALLET,
  wallet: {
    email: 'leora+235+1002@blockchain.com',
    email_code:
      'G4XNGu7Pg5yI3qDTyMXTduTFdDZaT40MREr3/yYwwo6vC+aRfqeZqTZlMStgWmsg/9Qq5sLW6LtFS5k/7J+bT2nPs6v2YDz+ud666sodqmTwtsRfEGSVAyW1XX5EUG+tNpA8Jk90coxQtGUL94XV99Yt64W6i9rdDEeDn4UCUhP/KZ4w3iK/og7bLSNFqPIf',
    guid: '543e134b-e022-4fd6-9185-700b5e90908a',
    has_cloud_backup: false,
    is_mobile_setup: false,
    nabu: {
      recovery_token: 'e728e8e6-a709-4768-bd51-b08b2796d853',
      user_id: '85d02fd0-c74d-4cc5-878e-a77bddb988a3'
    },
    two_fa_type: 0
  }
}

// TODO: cleanup this function
export const parseMagicLink = function* () {
  try {
    const magicLink = yield select(selectors.auth.getMagicLinkData)
    const {
      exchange: exchangeData,
      mergeable,
      product,
      unified,
      upgradeable,
      wallet: walletData
    } = magicLink
    const session = yield select(selectors.session.getSession, walletData.guid, walletData.email)
    const sessionIdFromLink = walletData.session_id

    if (!unified && (mergeable || upgradeable)) {
      if (product === ProductAuthOptions.WALLET && mergeable) {
        // send them to wallet password screen
        yield put(actions.auth.setAccountUnificationFlowType(AccountUnificationFlows.WALLET_MERGE))
      }
      if (product === ProductAuthOptions.EXCHANGE && mergeable) {
        // send them to exchange password screen
        yield put(
          actions.auth.setAccountUnificationFlowType(AccountUnificationFlows.EXCHANGE_MERGE)
        )
      }
      if (product === ProductAuthOptions.EXCHANGE && upgradeable) {
        // send them to exchange password screen
        yield put(
          actions.auth.setAccountUnificationFlowType(AccountUnificationFlows.EXCHANGE_UPGRADE)
        )
      }
    }
    // store data in the cache and update form values to be used to submit login
    if (product === ProductAuthOptions.WALLET) {
      // remove feature flag when not necessary
      const shouldPollForMagicLinkData = yield select(
        selectors.core.walletOptions.getPollForMagicLinkData
      )
      if (session !== sessionIdFromLink && shouldPollForMagicLinkData) {
        yield put(actions.form.change('login', 'step', LoginSteps.VERIFY_MAGIC_LINK))
      } else {
        // grab all the data from the JSON wallet data
        // store data in the cache and update form values to be used to submit login
        yield put(actions.cache.emailStored(walletData?.email))
        yield put(actions.cache.guidStored(walletData?.guid))
        yield put(actions.cache.mobileConnectedStored(walletData?.is_mobile_setup))
        yield put(actions.cache.hasCloudBackup(walletData.has_cloud_backup))
        yield put(actions.form.change('login', 'emailToken', walletData?.email_code))
        yield put(actions.form.change('login', 'guid', walletData?.guid))
        yield put(actions.form.change('login', 'email', walletData?.email))
        yield put(actions.auth.setMagicLinkInfo(magicLink))
        yield put(
          actions.auth.setProductAuthMetadata({
            platform: PlatformTypes.WEB,
            product: ProductAuthOptions.WALLET
          })
        )
        // check if mobile detected
        if (walletData?.is_mobile_setup) {
          yield put(actions.form.change('login', 'step', LoginSteps.VERIFICATION_MOBILE))
        } else {
          yield put(actions.form.change('login', 'step', LoginSteps.ENTER_PASSWORD_WALLET))
        }
      }
    }
    if (product === ProductAuthOptions.EXCHANGE) {
      // set state with all exchange login information
      yield put(actions.cache.emailStored(exchangeData?.email))
      yield put(actions.form.change('login', 'email', exchangeData?.email))
      if (walletData) {
        yield put(actions.form.change('login', 'emailToken', walletData?.email_code))
        yield put(actions.form.change('login', 'guid', walletData?.guid))
      }
      yield put(actions.auth.setMagicLinkInfo(magicLink))
      yield put(
        actions.auth.setProductAuthMetadata({
          platform: PlatformTypes.WEB,
          product: ProductAuthOptions.EXCHANGE
        })
      )
      yield put(actions.form.change('login', 'step', LoginSteps.ENTER_PASSWORD_EXCHANGE))
    }

    yield put(actions.auth.analyticsMagicLinkParsed())
  } catch (e) {
    yield put(actions.logs.logErrorMessage(logLocation, 'parseLink', e))
    yield put(actions.form.change('login', 'step', LoginSteps.ENTER_EMAIL_GUID))
    yield put(actions.alerts.displayError(C.MAGIC_LINK_PARSE_ERROR))
  }
}

// const sendMessageToMobile = (message) => {
//   console.log('message:', message)
//   if (window.webkit) {
//     window.webkit.messageHandlers.sessionHandler.postMessage(message)
//     return
//   }

//   if (window.Android) {
//     console.log('sending msg to david...')
//     window.Android.postMessage(message)
//     return
//   }

//   console.error('Could not find Android (window.Android) or iOS (window.webkit)')
// }

// window.receiveMessageFromMobile = (message) => {
//   sendMessageToMobile(message)
// }

export const loadMobileAuthWebView = function* () {
  const { product: appFromUrl } = yield select(selectors.auth.getProductAuthMetadata)
  // uses test object to save as magic link data
  // change to user real data
  yield put(actions.auth.setMagicLinkInfo(testMagicLinkData))
  const {
    exchange: exchangeData,
    mergeable,
    product: appFromMagicLink,
    upgradeable,
    wallet: walletData
  } = testMagicLinkData
  // TODO: why both appFromMagicLink and appFromUrl? can we just use one or the other?
  // TODO: set auth flow type to mobile version of whatever
  // The below are just placeholders
  if (appFromUrl === ProductAuthOptions.WALLET && mergeable) {
    yield put(actions.form.change('login', 'emailToken', walletData?.email_code))
    yield put(actions.form.change('login', 'guid', walletData?.guid))
    yield put(actions.form.change('login', 'email', walletData?.email))
    yield put(
      actions.auth.setAccountUnificationFlowType(AccountUnificationFlows.MOBILE_WALLET_MERGE)
    )
    yield put(actions.form.change('login', 'step', LoginSteps.ENTER_PASSWORD_WALLET))
  }
  if (appFromUrl === ProductAuthOptions.EXCHANGE && mergeable) {
    yield put(actions.form.change('login', 'email', exchangeData?.email))
    yield put(actions.form.change('login', 'emailToken', walletData?.email_code))
    yield put(actions.form.change('login', 'guid', walletData?.guid))
    yield put(actions.form.change('login', 'email', walletData?.email))
    yield put(
      actions.auth.setAccountUnificationFlowType(AccountUnificationFlows.MOBILE_EXCHANGE_MERGE)
    )
    yield put(actions.form.change('login', 'step', LoginSteps.ENTER_PASSWORD_EXCHANGE))
  }
  if (appFromMagicLink === ProductAuthOptions.EXCHANGE && upgradeable) {
    yield put(actions.form.change('login', 'email', exchangeData?.email))
    yield put(
      actions.auth.setAccountUnificationFlowType(AccountUnificationFlows.MOBILE_EXCHANGE_UPGRADE)
    )
    yield put(actions.form.change('login', 'step', LoginSteps.ENTER_PASSWORD_EXCHANGE))
  }
}
