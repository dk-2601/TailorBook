# Firestore + Google Auth Setup (TailorBook)

## 1. Enable Google Sign-In
1. Firebase Console -> Authentication.
2. Go to Sign-in method.
3. Enable `Google` provider.
4. Save.

## 2. Enable Firestore Database
1. Firebase Console -> Firestore Database.
2. Create database.

## 3. Set secure Firestore rules (per user)
Use this rule set:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /tailorbook_users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

This means:
- only logged-in users can access data
- each user can read/write only their own doc

## 4. Confirm app config
Open `js/cloud-config.js` and ensure:
- `enabled: true`
- Firebase keys are correct
- `collection: "tailorbook_users"`
- `requireAuth: true`

## 5. Run locally (not file://)
```bash
cd "/Users/a-1165/Movies/Wondershare Filmora Mac/Projects/TailorBook"
python3 -m http.server 8080
```
Open:
- `http://localhost:8080/index.html`

## 6. Validate in app
1. Sign in with Google.
2. Add customer/order.
3. Check Firestore:
   - collection: `tailorbook_users`
   - document id: your Firebase Auth UID

## 7. Debug status in browser console
```js
window.__TAILOR_AUTH_STATUS__
window.__TAILOR_FIRESTORE_STATUS__
```

If `lastError` is not null, rules or auth provider setup is usually the cause.
