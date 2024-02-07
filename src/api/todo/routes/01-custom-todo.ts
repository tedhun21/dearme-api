export default {
  routes: [
    {
      method: "PUT",
      path: "/todos/:date/updatePriority",
      handler: "todo.updatePriority",
    },
  ],
};
