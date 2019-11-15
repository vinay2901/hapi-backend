import "babel-polyfill";
const Hapi = require("hapi");
const Joi = require("joi");
const Mongoose = require("mongoose");
import fs from "fs";
import { generateToken, decodeToken } from "./session";
const Inert = require("inert");
const Path = require("path");
const server = Hapi.server({
  port: 4000,
  host: "localhost",
  routes: {
    cors: true,
    files: {
      relativeTo: Path.join(__dirname, "uploads")
    }
  }
});
Mongoose.connect("mongodb://localhost/hapi", { useUnifiedTopology: true });

const UserModel = Mongoose.model("user", {
  name: String,
  username: String,
  password: String,
  profilePic: String
});

const NoteModel = Mongoose.model("note", {
  userId: String,
  title: String,
  content: String
});

// const setup = async () => {
//   await server.register(Inert);

//   server.route({
//     method: "GET",
//     path: "/{uploads*}",
//     handler: {
//       directory: {
//         path: "uploads",
//         redirectToSlash: true,
//         index: true
//       }
//     }
//   });
server.route({
  method: "POST",
  path: "/user",

  options: {
    validate: {
      payload: {
        username: Joi.string().required(),
        name: Joi.string().required(),
        password: Joi.string().required()
      }
    }
  },
  handler: async (request, h) => {
    try {
      let userExist = await UserModel.findOne({
        username: request.payload.username
      });
      if (userExist) {
        return h.response({ error: "username already exists" }).code(400);
      }
      let newUser = new UserModel(request.payload);
      let result = await newUser.save();
      return h.response(result);
    } catch (error) {
      return h.response(error).code(500);
    }
  }
});

server.route({
  method: "POST",
  path: "/login",
  options: {
    validate: {
      payload: {
        username: Joi.string().required(),
        password: Joi.string().required()
      }
    }
  },
  handler: async (request, h) => {
    try {
      let user = await UserModel.findOne(request.payload).lean();
      if (user) {
        let token = await generateToken(user._id);
        user.token = token;
        return h.response(user);
      }
      return h.response({ error: "Invalid credentials" });
    } catch (error) {
      console.log("ERRRRR", error);
      return h.response(error).code(500);
    }
  }
});

server.route({
  method: "GET",
  path: "/user",

  options: {
    // validate: {
    //   headers: {
    //     token: Joi.string().required()
    //   }
    // },
    cors: {
      origin: ["*"],
      additionalHeaders: ["cache-control", "x-requested-with", "token"]
    }
  },
  handler: async (request, h) => {
    try {
      let user = await decodeToken(request.headers.token);
      if (!user) {
        return h.response({ error: "invalid token" }).code(400);
      }

      let userDetails = await UserModel.findOne({
        _id: user.id
      });

      return h.response(userDetails);
    } catch (error) {
      return h.response({ error: "invalid token" }).code(500);
    }
  }
});

// Notes crud operations

server.route({
  method: "POST",
  path: "/note",

  options: {
    cors: {
      origin: ["*"],
      additionalHeaders: ["cache-control", "x-requested-with", "token"]
    }
  },
  handler: async (request, h) => {
    try {
      let user = await decodeToken(request.headers.token);
      if (!user) {
        return h.response({ error: "invalid token" }).code(400);
      }
      let newNote = new NoteModel({
        title: request.payload.title,
        content: request.payload.content,
        userId: user.id
      });
      let result = await newNote.save();
      return h.response(result);
    } catch (error) {
      return h.response({ error: "invalid token" }).code(500);
    }
  }
});

//UPDATE NOTES

server.route({
  method: "PUT",
  path: "/note",

  options: {
    cors: {
      origin: ["*"],
      additionalHeaders: ["cache-control", "x-requested-with", "token"]
    }
  },
  handler: async (request, h) => {
    try {
      let user = await decodeToken(request.headers.token);
      if (!user) {
        return h.response({ error: "invalid token" }).code(400);
      }
      let existingNote = await NoteModel.findOne({
        _id: request.payload.id
      });
      if (!existingNote) {
        return h.response({ error: "invalid note" }).code(500);
      }
      existingNote.title = request.payload.title;
      existingNote.content = request.payload.content;
      await existingNote.save();
      return h.response(existingNote);
    } catch (error) {
      console.log("ERROR", error);
      return h.response({ error: "invalid token" }).code(500);
    }
  }
});

// Get ALL User Notes
server.route({
  method: "get",
  path: "/notes",

  options: {
    cors: {
      origin: ["*"],
      additionalHeaders: ["cache-control", "x-requested-with", "token"]
    }
  },
  handler: async (request, h) => {
    try {
      let user = await decodeToken(request.headers.token);
      if (!user) {
        return h.response({ error: "invalid token" }).code(400);
      }

      let result = await NoteModel.find(
        {
          userId: user.id
        },
        { id: 1, title: 1 }
      );
      return h.response({ message: "success", notes: result });
    } catch (error) {
      return h.response({ error: "invalid token" }).code(500);
    }
  }
});

server.route({
  method: "get",
  path: "/note",

  options: {
    cors: {
      origin: ["*"],
      additionalHeaders: ["cache-control", "x-requested-with", "token"]
    }
  },
  handler: async (request, h) => {
    try {
      let user = await decodeToken(request.headers.token);
      if (!user) {
        return h.response({ error: "invalid token" }).code(400);
      }

      if (!request.query.id) {
        return h.response({ error: "note id is required" });
      }

      let result = await NoteModel.findOne({
        userId: user.id,
        _id: request.query.id
      });
      return h.response({ message: "success", notes: result });
    } catch (error) {
      return h.response({ error: "invalid token" }).code(500);
    }
  }
});

// delete Note
server.route({
  method: "delete",
  path: "/note",

  options: {
    cors: {
      origin: ["*"],
      additionalHeaders: [
        "cache-control",
        "x-requested-with",
        "token",
        "content-type"
      ]
    }
  },
  handler: async (request, h) => {
    try {
      let user = await decodeToken(request.headers.token);
      if (!user) {
        return h.response({ error: "invalid token" }).code(400);
      }
      if (!request.payload["id"]) {
        return h.response({ error: "note id is required" }).code(400);
      }

      let result = await NoteModel.remove({
        userId: user.id,
        _id: request.payload.id
      });
      return h.response({ message: "success" });
    } catch (error) {
      console.log("---", error);
      return h.response({ error: "invalid token" }).code(500);
    }
  }
});

server.route({
  method: "POST",
  path: "/upload",
  handler: async (request, h) => {
    let user = await decodeToken(request.headers.token);
    if (!user) {
      return h.response({ error: "invalid token" }).code(400);
    }
    console.log("--------", user);
    let userExist = await UserModel.findOne({
      _id: user.id
    });
    const data = request.payload;

    if (data.file) {
      const name = data.file.hapi.filename;
      const extension = name.split(".")[name.split(".").length - 1];
      const nameToSave = `${user.id}.${extension}`;
      const path = `uploads/${nameToSave}`;
      const file = fs.createWriteStream(path);

      file.on("error", err => console.error(err));

      data.file.pipe(file);

      data.file.on("end", err => {
        const ret = {
          filename: data.file.hapi.filename,
          headers: data.file.hapi.headers
        };
        return JSON.stringify(ret);
      });
      userExist.profilePic = name;
      userExist.save();
      return h.response({ message: "success", profilePic: nameToSave });
    }
    return h.response({ error: "file required" }).code(400);
  },
  options: {
    payload: {
      output: "stream",
      parse: true,
      allow: "multipart/form-data"
    }
  }
});
server.start();
// };
// setup();
