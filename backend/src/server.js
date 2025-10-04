const http = require("http");
const { Server } = require("socket.io");
const app = require("./app.js");

const server = http.createServer(app);

const io = new Server(server, {
    cors: { origin: "*" },
});

io.on("connection", (socket) => {
    console.log("Socket connected:", socket.id);
    socket.on("joinDashboard", () => socket.join("interviewer-dashboard"));
});

app.set("io", io); // store io instance in app for global access

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
