import { createClient } from "@libsql/client";
import { SerializedPlayer, RoomData, PolygonCollider2dPoint } from "./types";

export const players: Record<string, SerializedPlayer> = {};

export const clients: Record<string, WebSocket> = {};

export const rooms: Record<string, RoomData> = {
  "0": { pinatas: {}, coins: [], initialPosition: { x: -0.5, y: -1.5 } }, // Spawn Room
  "1": { pinatas: {}, coins: [], initialPosition: { x: 0, y: 0 } }, // Cafe & Arcade
  "2": { pinatas: {}, coins: [], initialPosition: { x: -5.5, y: -1 } }, // Quarterdeck
  "3": { pinatas: {}, coins: [], initialPosition: { x: -4, y: -2 } }, // Observatory
  "4": { pinatas: {}, coins: [], initialPosition: { x: 3, y: 1 } }, // The Beach
  "5": { pinatas: {}, coins: [], initialPosition: { x: 0, y: 0 } }, // Construction
};

export const pinataState: Record<string, Array<string>> = {};

export const turso = createClient({
  url: Bun.env.TURSO_DATABASE_URL as string,
  authToken: Bun.env.TURSO_AUTH_TOKEN as string,
});

export const roomColliders: Record<string, Array<PolygonCollider2dPoint>> = {
  // Spawn Room
  "0": [
    {x: -9.623003, y: 5.867131},
    {x: -12.392586, y: 5.8133535},
    {x: -13.136926, y: 5.8586364},
    {x: -13.137081, y: 2.3943336},
    {x: -13.240295, y: -0.3158877},
    {x: -12.326065, y: -0.0738852},
    {x: -9.717818, y: 0.4638977},
    {x: -8.472546, y: 0.25765288},
    {x: -7.7157373, y: 0.25085166},
    {x: -7.000978, y: 1.3283231},
    {x: -5.6954465, y: 1.3286431},
    {x: -4.8798933, y: 1.9093722},
    {x: -4.422777, y: 2.0438185},
    {x: -4.101868, y: 2.1374512},
    {x: -1.0196908, y: 2.1479049},
    {x: -0.1378671, y: 2.1173654},
    {x: 1.6891775, y: 2.0953903},
    {x: 2.3795502, y: 0.456467},
    {x: 4.7439322, y: 0.8895793},
    {x: 5.404461, y: 1.7075016},
    {x: 7.9387054, y: 1.1187822},
    {x: 7.7078, y: 0.48543453},
    {x: 7.748202, y: -1.1856917},
    {x: 9.571691, y: -1.7474234},
    {x: 9.67559, y: -1.7296891},
    {x: 13.01417, y: -0.4291619},
    {x: 13.144287, y: 5.8873363}
  ],
  // Cafe & Arcade
  "1": [
    {x: -0.5207174, y: 6.3796077},
    {x: -9.678524, y: 6.278969},
    {x: -12.940104, y: 6.1360965},
    {x: -12.783479, y: -2.0064504},
    {x: -8.7973385, y: 0.82381797},
    {x: -8.367595, y: 0.9762274},
    {x: -7.086049, y: 1.3669358},
    {x: -2.2349577, y: 2.1435993},
    {x: 2.0814915, y: 2.256731},
    {x: 2.6123505, y: 3.29555},
    {x: 4.5592546, y: 3.1608806},
    {x: 4.6652355, y: 2.8026419},
    {x: 4.717091, y: 2.3938723},
    {x: 4.4650893, y: 1.5677814},
    {x: 5.8192687, y: 1.1552345},
    {x: 6.490562, y: 1.476866},
    {x: 6.766478, y: 2.6578548},
    {x: 7.3418603, y: 2.409164},
    {x: 8.394401, y: 3.4154146},
    {x: 8.746612, y: 3.2232995},
    {x: 9.60692, y: 2.7339606},
    {x: 9.670958, y: 0.42858016},
    {x: 13.863948, y: 0.4491558},
    {x: 13.927986, y: 1.665884},
    {x: 14.108566, y: 6.3224835}
  ],
  // Quarterdeck
  "2": [
    {x: -12.179999, y: 5.6299996},
    {x: -12.353427, y: -0.7162032},
    {x: -12.252874, y: -2.9878068},
    {x: -12.215593, y: -3.550611},
    {x: -9.636363, y: -2.155282},
    {x: -8.493596, y: -1.9728287},
    {x: -7.850015, y: 0.76222867},
    {x: -6.487813, y: 1.2712257},
    {x: -5.3141956, y: 0.76377964},
    {x: -4.841786, y: -0.4542328},
    {x: 0.2089234, y: -0.25372863},
    {x: 7.7462077, y: -1.0275311},
    {x: 9.494238, y: -1.7585595},
    {x: 10.72164, y: -2.5378258},
    {x: 12.130819, y: -3.866791},
    {x: 12.353428, y: -0.13811016},
    {x: 12.201642, y: 0.058334738},
    {x: 12.179999, y: 5.6299996}
  ],
  // Observatory
  "3": [
    {x: 10.459991, y: 6.1296163},
    {x: -12.179999, y: 5.6299996},
    {x: -12.179999, y: -2.0151892},
    {x: -12.17214, y: -5.551342},
    {x: 11.141538, y: -6.04286},
    {x: 11.422387, y: -5.264942},
    {x: 2.1375, y: -5.595639},
    {x: -8.533089, y: -4.483002},
    {x: -10.58926, y: -4.6296434},
    {x: -12.056372, y: -4.1198497},
    {x: -11.730432, y: -2.0257058},
    {x: -6.1869516, y: -0.5448959},
    {x: -5.3965006, y: 0.40346414},
    {x: -3.8155408, y: 0.012358993},
    {x: -1.3552792, y: -0.5511247},
    {x: -1.1262455, y: -1.5545776},
    {x: 0.09046358, y: -1.2291746},
    {x: 0.2553935, y: -0.29320946},
    {x: 2.8884172, y: 0.047484905},
    {x: 6.9936724, y: 0.10564065},
    {x: 9.255709, y: -0.52270746},
    {x: 9.282457, y: -3.6487422},
    {x: 10.287224, y: -4.2400312},
    {x: 11.9453125, y: -4.2381973},
    {x: 12.179999, y: -5.6299996},
    {x: 12.179999, y: 5.6299996}
  ],
  // The Beach
  "4": [
    {x: -12.179999, y: 5.6299996},
    {x: -12.179999, y: -2.0151892},
    {x: -12.17214, y: -5.551342},
    {x: 12.003246, y: -5.4683895},
    {x: 12.188348, y: -4.738343},
    {x: 4.3396387, y: -5.260531},
    {x: -8.533089, y: -4.483002},
    {x: -10.58926, y: -4.6296434},
    {x: -12.056372, y: -4.1198497},
    {x: -11.730432, y: -2.0257058},
    {x: -12.027407, y: -1.9332004},
    {x: -11.8593, y: -1.5114396},
    {x: -9.608122, y: -0.22700426},
    {x: -9.35, y: 0.9807981},
    {x: -7.110319, y: 2.1794844},
    {x: -4.4574323, y: 2.265524},
    {x: -1.9467452, y: 2.3876555},
    {x: 1.9309651, y: 2.8240955},
    {x: 7.9032507, y: 2.1162899},
    {x: 11.9413185, y: 1.366613},
    {x: 12.128063, y: 0.53048885},
    {x: 12.154813, y: -3.3615074},
    {x: 12.106382, y: -3.6655605},
    {x: 12.08893, y: -4.381815},
    {x: 12.179999, y: -5.6299996},
    {x: 12.179999, y: 5.6299996}
  ],
  // Construction
  "5": [
    {x: 4.9737444, y: -2.745378},
    {x: 4.3638563, y: -1.4476447},
    {x: 2.553877, y: 0.29664204},
    {x: 0.2435093, y: 1.1739352},
    {x: -5.5429444, y: 1.1091186},
    {x: -7.389821, y: 0.3555578},
    {x: -9.006247, y: -0.704656},
    {x: -10.300555, y: -2.0265632},
    {x: -10.394729, y: 4.9110956},
    {x: 10.383285, y: 4.8808866},
    {x: 10.33122, y: -4.8106794},
    {x: 5.195074, y: -4.76989}
  ]
}