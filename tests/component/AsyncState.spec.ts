import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import AsyncState from "@/components/base/AsyncState.vue";

const stubs = {
  "v-progress-circular": true,
  "v-alert": { template: "<div class='v-alert'><slot /></div>" }
};

describe("AsyncState", () => {
  it("shows the loader while loading", () => {
    const wrapper = mount(AsyncState, {
      props: { loading: true, error: null, empty: false },
      global: { stubs }
    });
    expect(wrapper.find("v-progress-circular-stub").exists()).toBe(true);
  });

  it("shows the error message", () => {
    const wrapper = mount(AsyncState, {
      props: { loading: false, error: "boom", empty: false },
      global: { stubs }
    });
    expect(wrapper.text()).toContain("boom");
  });

  it("shows the empty text", () => {
    const wrapper = mount(AsyncState, {
      props: { loading: false, error: null, empty: true, emptyText: "nothing" },
      global: { stubs }
    });
    expect(wrapper.text()).toContain("nothing");
  });

  it("renders the default slot on success", () => {
    const wrapper = mount(AsyncState, {
      props: { loading: false, error: null, empty: false },
      slots: { default: "<p>content</p>" },
      global: { stubs }
    });
    expect(wrapper.html()).toContain("content");
  });
});
