import jwt from "jsonwebtoken";

const secret = process.env.ACCESS_TOKEN_SECRET!;
const token = jwt.sign(
  {
    type: "access",
    jti: crypto.randomUUID(),
    sub: "cmt1awnr60002p2mpns0vb4m8",
  },
  secret,
  { algorithm: "HS256", expiresIn: 900, issuer: "hive", audience: "hive-api" },
);

const url = "ws://localhost:4001/ws?workspaceId=cmt1awnrg0004p2mp4fcp0dcr";
const ws = new WebSocket(url, { headers: { Cookie: `access_token=${token}` } });

ws.onopen = () => {
  console.log("OPEN");
  setTimeout(
    () =>
      ws.send(
        JSON.stringify({ type: "avatar.move", x: 12, y: 34, roomId: "room-1" }),
      ),
    500,
  );
  setTimeout(
    () => ws.send(JSON.stringify({ type: "presence.update", status: "away" })),
    800,
  );
};
ws.onmessage = (e) => {
  const msg = String(e.data);
  const ev = JSON.parse(msg);
  if (ev.type === "hello")
    console.log("HELLO members:", ev.members.length, "mapId:", ev.mapId);
  else console.log("EVENT:", ev.type, JSON.stringify(ev).slice(0, 120));
};
ws.onerror = (e) => console.log("ERROR", String(e));
ws.onclose = (e) => {
  console.log("CLOSE", e.code, e.reason);
  process.exit(0);
};
setTimeout(() => {
  console.log("--- timing out, closing");
  ws.close();
}, 2500);
