const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
const app = express();
app.use(express.json());
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();
module.exports = app;

const authenticationToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "MY_SECRET", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
};

app.post("/login/", async (request, response) => {
  const userDetails = request.body;
  const { username, password } = userDetails;
  const getUserQuery = `SELECT * FROM user 
    WHERE username = '${username}';`;

  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(
      `${password}`,
      dbUser.password
    );
    if (isPasswordMatched) {
      const payload = { username: dbUser.username };
      const jwtTokenGenerated = jwt.sign(payload, "MY_SECRET");
      response.send(`{"jwtToken": "${jwtTokenGenerated}"}`);
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

app.get("/states/", authenticationToken, async (request, response) => {
  const responseState = (each) => {
    return {
      stateId: each.state_id,
      stateName: each.state_name,
      population: each.population,
    };
  };

  const getStatesQuery = `SELECT * FROM state;`;

  const dbResponse = await db.all(getStatesQuery);
  response.send(dbResponse.map((each) => responseState(each)));
});

app.get("/states/:stateId/", authenticationToken, async (request, response) => {
  const { stateId } = request.params;

  const dbResponseObject = (dbResponse) => {
    return {
      stateId: dbResponse.state_id,
      stateName: dbResponse.state_name,
      population: dbResponse.population,
    };
  };

  const getStateQuery = `SELECT * FROM state 
    WHERE state_id = ${stateId};`;

  const dbResponse = await db.get(getStateQuery);
  response.send(dbResponseObject(dbResponse));
});

app.post("/districts/", authenticationToken, async (request, response) => {
  const districtDetails = request.body;

  const {
    districtName,
    stateId,
    cases,
    cured,
    active,
    deaths,
  } = districtDetails;

  const addDistrictQuery = `INSERT INTO 
    district(district_name,state_id,cases,cured,active,deaths)
    VALUES (${districtName},
        ${stateId},
        ${cases},
        ${cured},
        ${active},
        ${deaths});`;

  const dbResponse = await db.run(addDistrictQuery);

  response.send("District Successfully Added");
});

app.get(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const responseDistrict = (each) => {
      return {
        districtId: each.district_id,
        districtName: each.district_name,
        stateId: each.state_id,
        cases: each.cases,
        cured: each.cured,
        active: each.active,
        deaths: each.deaths,
      };
    };

    const getDistrictDetailsQuery = `SELECT * FROM district
    WHERE district_id = ${districtId};`;
    const dbResponse = await db.get(getDistrictDetailsQuery);
    response.send(dbResponse.map((each) => responseDistrict(each)));
  }
);

app.delete(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;

    const deleteDistrictQuery = `DELETE FROM district 
    WHERE district_id = ${districtId};`;

    const dbResponse = await db.run(deleteDistrictQuery);
    response.send("District Removed");
  }
);

app.put(
  "/districts/:districtId/",
  authenticationToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtDetails = request.body;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = districtDetails;

    const updateDistrictQuery = ` UPDATE district
    SET 
    district_name = '${districtName}',
    state_id = ${stateId},
    cases = ${cases},
    cured = ${cured},
    active = ${active},
    deaths = ${deaths}
    WHERE district_id = ${districtID};`;

    const dbResponse = await db.run(updateDistrictQuery);
    response.send("District Details Updated");
  }
);

app.get(
  "/states/:stateId/stats/",
  authenticationToken,
  async (request, response) => {
    const { stateId } = request.params;
    const getStateStatsQuery = `
    SELECT 
    SUM(cases),
    SUM(cured),
    SUM(active),
    SUM(deaths)
    FROM district
    WHERE state_id = ${stateId};`;

    const stats = await db.get(getStateStatsQuery);

    response.send({
      totalCases: stats["SUM(cases)"],
      totalCured: stats["SUM(cured)"],
      totalActive: stats["SUM(active)"],
      totalDeaths: stats["SUM(deaths)"],
    });
  }
);
