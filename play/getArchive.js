async function getToonkinsAccount() {
  const email = prompt("Email Address");
  if (!email || email.trim() == "") return;
  const pass = prompt("Password");
  if (!pass || pass.trim() == "") return;

  const authentication = await (
    await fetch(
      "https://ab3c.playfabapi.com/Client/LoginWithEmailAddress?sdk=UnitySDK-2.59.190123",
      {
        method: "POST",
        body: JSON.stringify({
          Email: email,
          InfoRequestParameters: null,
          Password: pass,
          TitleId: "AB3C",
        }),
        headers: { "Content-Type": "application/json" },
      },
    )
  ).json();
  if (authentication.code != 200)
    throw new Error("Failure to authenticate with provided details.");

  const playfabId = authentication.data.PlayFabId;
  const sessionTicket = authentication.data.SessionTicket;

  const account = await (
    await fetch("https://ab3c.playfabapi.com/Client/GetAccountInfo", {
      method: "POST",
      body: JSON.stringify({
        PlayFabId: playfabId,
      }),
      headers: {
        "X-Authorization": sessionTicket,
        "Content-Type": "application/json",
      },
    })
  ).json();

  const inventory = await (
    await fetch("https://ab3c.playfabapi.com/Client/GetUserInventory", {
      method: "POST",
      body: JSON.stringify({
        PlayFabId: playfabId,
      }),
      headers: {
        "X-Authorization": sessionTicket,
        "Content-Type": "application/json",
      },
    })
  ).json();

  console.log("------------------------------------------------");
  console.log("Account: ", account.data.AccountInfo.TitleInfo);
  console.log("TK/Coins: ", inventory.data.VirtualCurrency.TK);
  console.log("Inventory: ", inventory.data.Inventory);
  console.log("------------------------------------------------");
}
