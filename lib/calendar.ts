// Seeded calendar for the demo. In production: pull from Google/Outlook.

export type Meeting = {
  id: string;
  clientId: string;
  clientName: string;
  time: string;
  channel: string;
  topic: string;
};

export async function todaysMeetings(): Promise<Meeting[]> {
  return [
    { id: "m1", clientId: "wong-family",  clientName: "Wong Family",   time: "10:30", channel: "Office",  topic: "Education plan review" },
    { id: "m2", clientId: "tan-li-hua",   clientName: "Tan Li Hua",    time: "14:00", channel: "Zoom",    topic: "Year-end tax check-in" },
    { id: "m3", clientId: "rajesh-menon", clientName: "Rajesh Menon",  time: "16:30", channel: "Coffee",  topic: "Estate planning follow-up" }
  ];
}
