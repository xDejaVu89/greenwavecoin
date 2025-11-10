import { ethers } from "hardhat";
import express from "express";
import { Contract } from "ethers";

async function startDashboard() {
  const app = express();
  const port = process.env.DASHBOARD_PORT || 3000;
  
  // Store gas usage metrics
  let metrics = {
    transfers: [] as any[],
    approvals: [] as any[],
    deployments: [] as any[]
  };

  app.use(express.json());

  // Serve static dashboard
  app.get("/", (req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>GreenWaveCoin Gas Monitor</title>
          <script src="https://cdn.plot.ly/plotly-latest.min.js"></script>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .chart { margin: 20px 0; height: 400px; }
          </style>
        </head>
        <body>
          <h1>GreenWaveCoin Gas Usage Dashboard</h1>
          <div id="transferChart" class="chart"></div>
          <div id="approvalChart" class="chart"></div>
          <div id="deploymentChart" class="chart"></div>
          <script>
            function updateCharts() {
              fetch('/metrics')
                .then(res => res.json())
                .then(data => {
                  Plotly.newPlot('transferChart', [{
                    x: data.transfers.map(t => t.timestamp),
                    y: data.transfers.map(t => t.gas),
                    type: 'scatter',
                    name: 'Transfer Gas'
                  }], {
                    title: 'Transfer Gas Usage Over Time'
                  });

                  Plotly.newPlot('approvalChart', [{
                    x: data.approvals.map(t => t.timestamp),
                    y: data.approvals.map(t => t.gas),
                    type: 'scatter',
                    name: 'Approval Gas'
                  }], {
                    title: 'Approval Gas Usage Over Time'
                  });

                  Plotly.newPlot('deploymentChart', [{
                    x: data.deployments.map(t => t.timestamp),
                    y: data.deployments.map(t => t.gas),
                    type: 'scatter',
                    name: 'Deployment Gas'
                  }], {
                    title: 'Deployment Gas Usage'
                  });
                });
            }

            // Update every 30 seconds
            setInterval(updateCharts, 30000);
            updateCharts();
          </script>
        </body>
      </html>
    `);
  });

  // API endpoint for metrics
  app.get("/metrics", (req, res) => {
    res.json(metrics);
  });

  // Record new metrics
  app.post("/record", (req, res) => {
    const { type, gas, timestamp = new Date().toISOString() } = req.body;
    if (type in metrics) {
      (metrics as any)[type].push({ gas, timestamp });
      res.json({ success: true });
    } else {
      res.status(400).json({ error: "Invalid metric type" });
    }
  });

  app.listen(port, () => {
    console.log(`Gas monitoring dashboard running on http://localhost:${port}`);
  });

  return app;
}

// Start dashboard if run directly
if (require.main === module) {
  startDashboard();
}

export { startDashboard };