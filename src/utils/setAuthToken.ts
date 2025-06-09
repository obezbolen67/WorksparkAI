// src/utils/setAuthToken.ts
// We'll use a global fetch wrapper approach instead of modifying axios/fetch prototypes
// This is a placeholder file in case we want to build a more complex API client later.
// For now, we will add the header manually in the context.
const setAuthToken = (token: string | null) => {
  // In a real app with a dedicated API client like Axios, you'd do:
  // if (token) {
  //   axios.defaults.headers.common['x-auth-token'] = token;
  // } else {
  //   delete axios.defaults.headers.common['x-auth-token'];
  // }
};

export default setAuthToken;