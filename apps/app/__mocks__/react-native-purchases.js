// Jest manual mock for react-native-purchases (a native module, no JS binding under jest). Auto-applied for
// any test importing the native purchases seam. A minimal Purchases with no active entitlements + the
// PACKAGE_TYPE enum the seam reads. Paywall tests mock the './purchases' seam directly, so this is a
// defensive default that keeps the native seam loadable in tests without the binary.
const PACKAGE_TYPE = {
  UNKNOWN: 'UNKNOWN',
  CUSTOM: 'CUSTOM',
  LIFETIME: 'LIFETIME',
  ANNUAL: 'ANNUAL',
  SIX_MONTH: 'SIX_MONTH',
  THREE_MONTH: 'THREE_MONTH',
  TWO_MONTH: 'TWO_MONTH',
  MONTHLY: 'MONTHLY',
  WEEKLY: 'WEEKLY',
};

const emptyInfo = { entitlements: { active: {} } };

class Purchases {
  static configure() {}
  static addCustomerInfoUpdateListener() {}
  static removeCustomerInfoUpdateListener() {
    return true;
  }
  static async getOfferings() {
    return { current: null, all: {} };
  }
  static async purchasePackage() {
    return { customerInfo: emptyInfo, productIdentifier: '' };
  }
  static async restorePurchases() {
    return emptyInfo;
  }
  static async logIn() {
    return { customerInfo: emptyInfo, created: false };
  }
  static async logOut() {
    return emptyInfo;
  }
}

module.exports = { __esModule: true, default: Purchases, PACKAGE_TYPE };
