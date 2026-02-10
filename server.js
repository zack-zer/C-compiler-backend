const express = require("express");
const cors = require("cors");
const fs = require("fs");
const { spawn } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

app.post("/run", (req, res) => {
    const { code, input } = req.body;
    const id = Date.now();

    const cFile = `temp_${id}.c`;
    const exeFile = `temp_${id}`;

    fs.writeFileSync(cFile, code);

    // 1️⃣ Compile C code
    const compile = spawn("gcc", [cFile, "-o", exeFile]);

    let compileError = "";

    compile.stderr.on("data", (data) => {
        compileError += data.toString();
    });

    compile.on("close", (compileStatus) => {
        if (compileStatus !== 0) {
            cleanup();
            return res.json({ output: compileError });
        }

        // 2️⃣ Run compiled program
        const run = spawn(`./${exeFile}`);

        let stdout = "";
        let stderr = "";

        run.stdout.on("data", (data) => {
            stdout += data.toString();
        });

        run.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        // 3️⃣ Send input to stdin (scanf support)
        if (input && input.length > 0) {
            run.stdin.write(input);
        }
        run.stdin.end();

        // 4️⃣ Safety timeout (avoid infinite loops)
        const timer = setTimeout(() => {
            run.kill("SIGKILL");
        }, 2000);

        run.on("close", () => {
            clearTimeout(timer);
            cleanup();

            res.json({
                output: stdout || stderr || ""
            });
        });
    });

    function cleanup() {
        if (fs.existsSync(cFile)) fs.unlinkSync(cFile);
        if (fs.existsSync(exeFile)) fs.unlinkSync(exeFile);
    }
});


// 🔴 VERY IMPORTANT FOR DEPLOYMENT (Render, Railway, Fly.io)
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("C Compiler backend running on port", PORT);
});
