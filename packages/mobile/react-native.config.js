/**
 * Skip ClerkExpo native iOS module. It pulls ClerkKit/ClerkKitUI via SPM and
 * breaks `pod install` with useFrameworks: static (target nil in RN spm.rb).
 * Auth uses the JS Clerk SDK + custom screens; native Clerk UI is unused.
 */
module.exports = {
  dependencies: {
    "@clerk/expo": {
      platforms: {
        ios: null,
      },
    },
  },
};
