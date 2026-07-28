function messagesFrom(event) {
  const data = event && event.detail && event.detail.data;
  if (!Array.isArray(data)) return [];
  return data.filter((message) => message && typeof message === 'object');
}

module.exports = {
  messagesFrom,
};
