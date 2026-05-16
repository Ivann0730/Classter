const sessionKey = process.argv[2];
const classId = process.argv[3] || 'CS301';

if (!sessionKey) {
  console.log('Usage: node test-40-checkins.js <sessionKey> <classId>');
  process.exit(1);
}

const API_BASE = 'http://localhost:4000';

async function simulateCheckins() {
  console.log(`Simulating 40 check-ins for session: ${sessionKey}, class: ${classId}`);

  for (let i = 1; i <= 40; i++) {
    const studentId = `2021-${String(i).padStart(4, '0')}`;

    try {
      const res = await fetch(`${API_BASE}/checkin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
          sessionKey,
          classId,
        }),
      });

      const data = await res.json();

      if (data.success) {
        console.log(`✓ ${studentId} — ${data.action} at ${data.checkIn}`);
      } else {
        console.log(`✗ ${studentId} — ${data.error}`);
      }
    } catch (e) {
      console.log(`✗ ${studentId} — fetch error: ${e.message}`);
    }

    // Small delay to avoid overwhelming the server
    await new Promise(r => setTimeout(r, 50));
  }

  console.log('\n✓ Done!');
  console.log('Now check the teacher dashboard.');
}

simulateCheckins();
