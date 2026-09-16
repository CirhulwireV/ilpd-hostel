# ILPD Hostel — Dynamic Structure Update

Changes in this version:
- Removed automatic creation of the hardcoded "Umutakara (Main House)" and "Hostel Block (Outside)" blocks.
- Rooms tab now displays blocks from the database instead of hardcoded location buttons.
- Add Room block selector is driven by configured blocks.
- Hostel Structure > Categories no longer has a Location field.
- Categories are admin-managed/global; rooms select from active categories.
- Removed hardcoded location labels from the public Rooms/Home presentation.
- Room creation now stores the selected block name in `hostelSection` for both legacy accommodation types.
- Added `backend/removeLegacyHardcodedBlocks.js` to safely remove the old hardcoded blocks if they exist and have no rooms. It never deletes a block that still has rooms.
- Frontend production build was tested successfully with `npm run build`.

Legacy compatibility:
- `accommodationType` is retained internally because the existing booking/rate system uses it for billing period (night/month).
- Existing database rooms and categories are not automatically deleted or modified by the frontend changes.
