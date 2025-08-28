const SERVICE_NAME = "NotificationUtils";

// Load message templates directly
const messageTemplates = {
	monitorUpAlert: "✅ Uptime Alert: Monitor is back online\n\n📌 Monitor: {monitorName}\n🔗 {urlLabel}: {url}\n📊 Type: {monitorType}\n📅 Time: {time}\n⚠️ Status: UP\n📟 Status Code: {code}\n⏱️ Response Time: {responseTime}ms\n📝 Message: {message}\n\u200B\n",
	monitorDownAlert: "🚨 Downtime Alert: Monitor went offline\n\n📌 Monitor: {monitorName}\n🔗 {urlLabel}: {url}\n📊 Type: {monitorType}\n📅 Time: {time}\n⚠️ Status: DOWN\n📟 Status Code: {code}\n⏱️ Response Time: {responseTime}ms\n📝 Error: {message}\n\u200B\n"
};

class NotificationUtils {
	static SERVICE_NAME = SERVICE_NAME;

	constructor({ stringService, emailService }) {
		this.stringService = stringService;
		this.emailService = emailService;
	}

	get serviceName() {
		return NotificationUtils.SERVICE_NAME;
	}

	buildTestEmail = async () => {
		const context = { testName: "Monitoring System" };
		const html = await this.emailService.buildEmail("testEmailTemplate", context);
		return html;
	};

	buildStatusEmail = async (networkResponse) => {
		const { monitor, status, prevStatus } = networkResponse;
		const template = prevStatus === false ? "serverIsUpTemplate" : "serverIsDownTemplate";
		const context = { monitor: monitor.name, url: monitor.url };
		const subject = `Monitor ${monitor.name} is ${status === true ? "up" : "down"}`;
		const html = await this.emailService.buildEmail(template, context);
		return { subject, html };
	};

	buildWebhookMessage = (networkResponse) => {
		const { monitor, status, code, timestamp, responseTime, message } = networkResponse;
		
		// Log the monitor data for debugging
		console.log("Building webhook message for monitor:", {
			name: monitor?.name,
			url: monitor?.url,
			type: monitor?.type,
			status,
			code,
			responseTime,
			message
		});
		// Format timestamp using the local system timezone
		const formatTime = (timestamp) => {
			const date = new Date(timestamp);

			// Get timezone abbreviation and format the date
			const timeZoneAbbr = date.toLocaleTimeString("en-US", { timeZoneName: "short" }).split(" ").pop();

			// Format the date with readable format
			return (
				date
					.toLocaleString("en-US", {
						year: "numeric",
						month: "2-digit",
						day: "2-digit",
						hour: "2-digit",
						minute: "2-digit",
						second: "2-digit",
						hour12: false,
					})
					.replace(/(\d+)\/(\d+)\/(\d+),\s/, "$3-$1-$2 ") +
				" " +
				timeZoneAbbr
			);
		};

		// Get formatted time
		const formattedTime = timestamp ? formatTime(timestamp) : formatTime(new Date().getTime());

		// Determine the URL/Host label based on monitor type
		let urlLabel = "URL";
		let urlValue = monitor.url || "N/A";
		
		if (monitor.type === "ping") {
			urlLabel = "Host/IP";
		} else if (monitor.type === "port") {
			urlLabel = "Host:Port";
			if (monitor.port) {
				urlValue = `${monitor.url}:${monitor.port}`;
			}
		} else if (monitor.type === "docker") {
			urlLabel = "Container";
		}

		// Determine appropriate error message
		let errorMessage = message;
		if (!errorMessage) {
			if (monitor.type === "ping") {
				errorMessage = status ? "Host is reachable" : "Host is unreachable";
			} else if (monitor.type === "port") {
				errorMessage = status ? "Port is open" : "Port is closed or unreachable";
			} else if (monitor.type === "http") {
				errorMessage = status ? "HTTP service is responding" : (code ? `HTTP ${code} error` : "HTTP service is not responding");
			} else {
				errorMessage = status ? "Monitor is responding normally" : "Monitor is not responding";
			}
		}

		// Create different messages based on status with extra spacing
		let messageText;
		if (status === true) {
			messageText = messageTemplates.monitorUpAlert
				.replace(/{monitorName}/g, monitor?.name || "Unknown")
				.replace(/{url}/g, urlValue)
				.replace(/{urlLabel}/g, urlLabel)
				.replace(/{monitorType}/g, monitor?.type || "Unknown")
				.replace(/{time}/g, formattedTime)
				.replace(/{code}/g, code || "N/A")
				.replace(/{responseTime}/g, responseTime || "N/A")
				.replace(/{message}/g, errorMessage);
		} else {
			messageText = messageTemplates.monitorDownAlert
				.replace(/{monitorName}/g, monitor?.name || "Unknown")
				.replace(/{url}/g, urlValue)
				.replace(/{urlLabel}/g, urlLabel)
				.replace(/{monitorType}/g, monitor?.type || "Unknown")
				.replace(/{time}/g, formattedTime)
				.replace(/{code}/g, code || "N/A")
				.replace(/{responseTime}/g, responseTime || "N/A")
				.replace(/{message}/g, errorMessage);
		}
		
		console.log("Final message text (first 200 chars):", messageText.substring(0, 200));
		return messageText;
	};

	buildHardwareAlerts = async (networkResponse) => {
		const monitor = networkResponse?.monitor;
		const thresholds = networkResponse?.monitor?.thresholds;
		const { usage_cpu: cpuThreshold = -1, usage_memory: memoryThreshold = -1, usage_disk: diskThreshold = -1 } = thresholds;

		const metrics = networkResponse?.payload?.data;
		const { cpu: { usage_percent: cpuUsage = -1 } = {}, memory: { usage_percent: memoryUsage = -1 } = {}, disk = [] } = metrics;

		const alerts = {
			cpu: cpuThreshold !== -1 && cpuUsage > cpuThreshold ? true : false,
			memory: memoryThreshold !== -1 && memoryUsage > memoryThreshold ? true : false,
			disk: disk?.some((d) => diskThreshold !== -1 && typeof d?.usage_percent === "number" && d?.usage_percent > diskThreshold) ?? false,
		};

		const alertsToSend = [];
		const alertTypes = ["cpu", "memory", "disk"];
		for (const type of alertTypes) {
			// Iterate over each alert type to see if any need to be decremented
			if (alerts[type] === true) {
				monitor[`${type}AlertThreshold`]--; // Decrement threshold if an alert is triggered

				if (monitor[`${type}AlertThreshold`] <= 0) {
					// If threshold drops below 0, reset and send notification
					monitor[`${type}AlertThreshold`] = monitor.alertThreshold;

					const formatAlert = {
						cpu: () => `Your current CPU usage (${(cpuUsage * 100).toFixed(0)}%) is above your threshold (${(cpuThreshold * 100).toFixed(0)}%)`,
						memory: () =>
							`Your current memory usage (${(memoryUsage * 100).toFixed(0)}%) is above your threshold (${(memoryThreshold * 100).toFixed(0)}%)`,
						disk: () =>
							`Your current disk usage: ${disk
								.map((d, idx) => `(Disk${idx}: ${(d.usage_percent * 100).toFixed(0)}%)`)
								.join(", ")} is above your threshold (${(diskThreshold * 100).toFixed(0)}%)`,
					};
					alertsToSend.push(formatAlert[type]());
				}
			}
		}
		await monitor.save();
		return alertsToSend;
	};

	buildHardwareEmail = async (networkResponse, alerts) => {
		const { monitor } = networkResponse;
		const template = "hardwareIncidentTemplate";
		const context = { monitor: monitor.name, url: monitor.url, alerts };
		const subject = `Monitor ${monitor.name} infrastructure alerts`;
		const html = await this.emailService.buildEmail(template, context);
		return { subject, html };
	};

	buildHardwareNotificationMessage = (alerts) => {
		return alerts.map((alert) => alert).join("\n");
	};
}

export default NotificationUtils;
