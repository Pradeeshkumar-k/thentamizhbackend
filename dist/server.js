"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
// Start the server (Warmup + Chapter Cache Enabled)
const PORT = process.env.PORT || 5000;
app_1.default.listen(PORT, async () => {
    console.log(`Server is running on port ${PORT}`);
    // Redis disabled
});
