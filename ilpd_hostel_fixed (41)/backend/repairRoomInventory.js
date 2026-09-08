require("dotenv").config();
const mongoose = require("mongoose");
mongoose.set("autoIndex", false);
const Room = require("./models/Room");
const Booking = require("./models/Booking");
const AccommodationMonitoring = require("./models/AccommodationMonitoring");
const { INVENTORY } = require("./inventory");
const { ACTIVE_BOOKING_STATUSES } = require("./utils/bookingRules");

const key = r => `${r.accommodationType}|${r.roomNumber}|${r.hostelSection || ""}`;
const activeBookingStatuses = new Set(["pending","confirmed","check-in-requested","checked-in","check-out-requested"]);

// Recompute every room's status from its actual bookings. Merging duplicates
// reassigns bookings onto a "keeper" room but never touched that room's
// status field, so rooms could be stuck "booked" with nothing booking them
// (or vice versa) — which makes them silently disappear from availability
// searches even though nothing is actually wrong with the dates requested.
async function resyncRoomStatuses() {
  const rooms = await Room.find({ status: { $ne: "maintenance" } }).select("_id status");
  let flipped = 0;
  for (const room of rooms) {
    const hasActiveBooking = await Booking.exists({
      status: { $in: ACTIVE_BOOKING_STATUSES },
      $or: [
        { room: room._id, occupants: { $size: 0 } },
        { occupants: { $elemMatch: { room: room._id, status: { $ne: "checked-out" } } } },
      ],
    });
    const correctStatus = hasActiveBooking ? "booked" : "available";
    if (room.status !== correctStatus) {
      await Room.updateOne({ _id: room._id }, { $set: { status: correctStatus } });
      flipped++;
    }
  }
  return { checked: rooms.length, flipped };
}

async function dropIdentityIndexes() {
  const indexes = await Room.collection.indexes();
  for (const i of indexes) {
    if (["roomNumber_1","accommodationType_1_roomNumber_1","accommodationType_1_roomNumber_1_hostelSection_1"].includes(i.name)) {
      try { await Room.collection.dropIndex(i.name); } catch (e) { if (e.codeName !== "IndexNotFound") throw e; }
    }
  }
}

async function refsFor(id) {
  const [direct, occupant, monitoring] = await Promise.all([
    Booking.find({room:id}).select("_id status checkIn checkOut").lean(),
    Booking.find({"occupants.room":id}).select("_id status checkIn checkOut occupants").lean(),
    AccommodationMonitoring.countDocuments({room:id})
  ]);
  return {direct, occupant, monitoring};
}
function intervals(refs,id) {
  const out=[];
  for (const b of [...refs.direct,...refs.occupant]) {
    if (!activeBookingStatuses.has(b.status)) continue;
    if (String(b.room)===String(id)) out.push([new Date(b.checkIn),new Date(b.checkOut),String(b._id)]);
    for (const o of (b.occupants||[])) if (String(o.room)===String(id) && o.status!=="checked-out") out.push([new Date(o.plannedCheckIn||b.checkIn),new Date(o.plannedCheckOut||b.checkOut),String(b._id)]);
  }
  return out;
}
function overlaps(a,b){return a[0] < b[1] && b[0] < a[1];}

async function mergeGroup(rows, identity) {
  const scored=[];
  for (const r of rows) {
    const refs=await refsFor(r._id);
    scored.push({r,refs,intervals:intervals(refs,r._id),history:refs.direct.length+refs.occupant.length});
  }
  for(let i=0;i<scored.length;i++) for(let j=i+1;j<scored.length;j++) for(const a of scored[i].intervals) for(const b of scored[j].intervals)
    if(overlaps(a,b)) throw new Error(`Cannot safely merge ${identity}: overlapping active bookings ${a[2]} and ${b[2]}. No data was deleted.`);
  scored.sort((a,b)=>(b.intervals.length-a.intervals.length)||(b.history-a.history)||(b.refs.monitoring-a.refs.monitoring)||Number(Boolean(b.r.imageData))-Number(Boolean(a.r.imageData))||String(a.r._id).localeCompare(String(b.r._id)));
  const keeper=scored[0].r;
  for(const x of scored.slice(1)){
    await Booking.updateMany({room:x.r._id},{$set:{room:keeper._id}});
    await Booking.updateMany({"occupants.room":x.r._id},{$set:{"occupants.$[o].room":keeper._id}},{arrayFilters:[{"o.room":x.r._id}]});
    await AccommodationMonitoring.updateMany({room:x.r._id},{$set:{room:keeper._id}});
    if(!keeper.imageData && x.r.imageData){ keeper.imageData=x.r.imageData; keeper.imageName=x.r.imageName||""; }
    await Room.deleteOne({_id:x.r._id});
  }
  await keeper.save();
}

async function normalizeSections(){
  const outside=await Room.find({accommodationType:"outside_hostel"}).sort({_id:1});
  const byNum=new Map();
  for(const r of outside){const n=Number(r.roomNumber); if(!Number.isInteger(n)) continue; if(!byNum.has(n))byNum.set(n,[]); byNum.get(n).push(r);}
  for(const [n,rows] of byNum){
    if(n<101||n>139) continue;
    if(n===114){
      const ak=rows.find(r=>r.hostelSection==="AKAGERA");
      const ka=rows.find(r=>r.hostelSection==="KARISIMBI");
      const un=rows.filter(r=>!r.hostelSection);
      if(!ak && un.length) {un.shift().hostelSection="AKAGERA"; await un[0].save();}
      if(!ka){const candidate=un.shift(); if(candidate){candidate.hostelSection="KARISIMBI"; await candidate.save();}}
      continue;
    }
    const desired=n<=114?"AKAGERA":"KARISIMBI";
    for(const r of rows) if(r.hostelSection!==desired){r.hostelSection=desired;r.hostelSections=[desired];await r.save();}
  }
  await Room.updateMany({accommodationType:"ilpd_building"},{$unset:{hostelSection:"",hostelSections:""}});
}

async function main(){
  if(!process.env.MONGO_URI) throw new Error("MONGO_URI is required.");
  await mongoose.connect(process.env.MONGO_URI);
  await dropIdentityIndexes();
  await normalizeSections();
  const rooms=await Room.find({}); const groups=new Map();
  for(const r of rooms){const k=key(r);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  let merged=0;
  for(const [k,rows] of groups) if(rows.length>1){await mergeGroup(rows,k);merged+=rows.length-1;}
  // Create/update only the authoritative 128 records. Existing status, bookings and photos remain intact.
  const byKey=new Map((await Room.find({})).map(r=>[key(r),r]));
  const {getBaseRate}=require("./utils/bookingRules");
  let created=0, updated=0;
  for(const spec of INVENTORY){
    const k=key(spec); let r=byKey.get(k);
    if(!r){r=await Room.create({roomNumber:spec.roomNumber,category:spec.category,accommodationType:spec.accommodationType, ...(spec.hostelSection?{hostelSection:spec.hostelSection,hostelSections:[spec.hostelSection]}:{hostelSections:[]}),price:getBaseRate(spec.category,spec.accommodationType),status:"available",imageData:"",imageName:""});created++;}
    else {r.category=spec.category;r.price=getBaseRate(spec.category,spec.accommodationType);if(spec.hostelSection){r.hostelSection=spec.hostelSection;r.hostelSections=[spec.hostelSection];}else{r.set("hostelSection",undefined);r.hostelSections=[];}await r.save();updated++;}
  }
  // Remove only non-inventory rooms with no booking history. Historical non-inventory rooms are preserved and reported.
  const allowed=new Set(INVENTORY.map(key)); let removed=0,preserved=0;
  for(const r of await Room.find({})){
    if(allowed.has(key(r)))continue;
    const used=await Booking.exists({$or:[{room:r._id},{"occupants.room":r._id}]});
    if(used){preserved++;}else{await Room.deleteOne({_id:r._id});removed++;}
  }
  await Room.collection.createIndex({accommodationType:1,roomNumber:1,hostelSection:1},{unique:true,name:"accommodationType_1_roomNumber_1_hostelSection_1"});
  const statusResync = await resyncRoomStatuses();
  const final=await Room.find({}).lean(); const dup=new Map(); for(const r of final){const k=key(r);dup.set(k,(dup.get(k)||0)+1);}
  const duplicateKeys=[...dup].filter(([,n])=>n>1);
  console.log("Room inventory repair completed.");
  console.log(`Target inventory: ${INVENTORY.length}`);
  console.log(`Created: ${created}; updated: ${updated}; merged duplicates: ${merged}; removed unused non-inventory: ${removed}; preserved historical non-inventory: ${preserved}`);
  console.log(`Status resync: checked ${statusResync.checked} rooms, corrected ${statusResync.flipped} that had a stale status.`);
  console.log(`Final room records: ${final.length}`);
  console.log(`Duplicate inventory identities: ${duplicateKeys.length}`);
  if(duplicateKeys.length) throw new Error(`Duplicate identities remain: ${duplicateKeys.map(([k,n])=>`${k} (${n})`).join(", ")}`);
  if(final.length!==INVENTORY.length && preserved===0) throw new Error(`Expected ${INVENTORY.length} rooms, found ${final.length}.`);
  console.log("AKAGERA 101-114: 14 | KARISIMBI 114-139: 26 | Main House: 88 | Intended total: 128");
  await mongoose.disconnect();
}
main().catch(async e=>{console.error("Room inventory repair failed:",e.message);try{await mongoose.disconnect();}catch(_){}process.exit(1);});
