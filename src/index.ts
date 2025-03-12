function parseInput(input: string): string[] | null {
  input = input.trim();

  if (input.startsWith("[") && input.endsWith("]")) {
    try {
      const fixedJson = input.replace(/'/g, '"').replace(/,\s*]/g, "]");
      const parsed = JSON.parse(fixedJson);

      if (
        Array.isArray(parsed) &&
        parsed.every((url) => typeof url === "string")
      ) {
        return parsed.map((url) => url.trim());
      }
    } catch (e) {
      alert("Invalid JSON array format");
      return null;
    }
  }

  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function normalizeStunUrl(url: string): string {
  url = url.trim();
  return url.startsWith("stun:") ? url : "stun:" + url;
}

const STUN_URL_REGEX =
  /^stun:(?:(?:(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,})|(?:(?:25[0-5]|2[0-4][0-9]|1?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|1?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|1?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|1?[0-9][0-9]?)))(?::([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?$/;

function isValidStunUrl(stunUrl: string): boolean {
  return STUN_URL_REGEX.test(stunUrl);
}

interface TestResult {
  server: string;
  status: string;
  statusClass: string;
}

function testStunServer(stunUrl: string): Promise<TestResult> {
  return new Promise((resolve) => {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: stunUrl }],
    });

    let resolved = false;

    function finalize(status: string, statusClass: string) {
      if (!resolved) {
        resolved = true;
        resolve({ server: stunUrl, status, statusClass });
        pc.close();
      }
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate.includes("srflx")) {
        finalize("✅ Working", "success");
      }
    };

    pc.onicegatheringstatechange = () => {
      if (pc.iceGatheringState === "complete") {
        finalize("❌ Failed", "fail");
      }
    };

    pc.createDataChannel("");
    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .catch(() => finalize("❌ Failed", "fail"));

    setTimeout(() => finalize("❌ Timeout", "fail"), 5000);
  });
}

async function testAllStunServers(): Promise<void> {
  const textarea = document.getElementById("stun-list") as HTMLTextAreaElement;
  const _stunServers = parseInput(textarea.value);

  if (!_stunServers) {
    return;
  }

  const stunServers = _stunServers.map(normalizeStunUrl);

  if (stunServers.length === 0 || !stunServers.every(isValidStunUrl)) {
    alert("Please enter valid STUN server URLs.");
    return;
  }

  const resultTable = document.querySelector("#result-table tbody");
  if (!resultTable) {
    return;
  }

  resultTable.innerHTML = "<tr><td colspan='2'>Testing...</td></tr>";

  const results = await Promise.all(stunServers.map(testStunServer));

  resultTable.innerHTML = "";

  results.forEach(({ server, status, statusClass }) => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${server}</td><td class="${statusClass}">${status}</td>`;
    resultTable.appendChild(row);
  });
}

document
  .getElementById("check-btn")
  ?.addEventListener("click", testAllStunServers);
