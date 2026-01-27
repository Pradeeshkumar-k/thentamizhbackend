"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const novelController_1 = require("./controllers/novelController");
// Start the server (Warmup + Chapter Cache Enabled)
const PORT = process.env.PORT || 5000;
app_1.default.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    // Trigger Cache Warmup
    await (0, novelController_1.warmUpCache)();
});
