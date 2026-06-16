

async function test() {
  try {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@school.mw', password: 'password123' })
    });
    
    const loginData = await loginRes.json();
    if (!loginRes.ok) {
      console.error("Login failed:", loginData);
      return;
    }
    
    console.log("Logged in successfully. Token length:", loginData.token.length);
    
    const feesRes = await fetch('http://localhost:5000/api/classes-with-fees', {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    
    console.log("Classes with fees status:", feesRes.status);
    const feesData = await feesRes.json();
    console.log("Classes with fees response:", feesData);
    
  } catch (err) {
    console.error("Error during test:", err);
  }
}

test();
