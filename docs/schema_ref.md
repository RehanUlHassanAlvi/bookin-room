# Firestore Schema References

## Users
- Collection: `users`
- Fields: `email`, `firstname`, `lastname`, `role`, `companyId`, `adminId`, `createdAt`

## Reservations
- Collection: `reservations`
- Fields: `userId`, `companyId`, `roomId`, `start_date`, `end_date`, `text`, `roomName`

## Invited Users
- Collection: `invitedUsers`
- Fields: `userId`, `companyId`, `adminId`, `email`
