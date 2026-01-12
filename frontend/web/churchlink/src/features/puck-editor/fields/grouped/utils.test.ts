import {
  getValueAtPath,
  setValueAtPath,
  addArrayItem,
  removeArrayItem,
  moveArrayItem,
} from "./utils";

describe("Dot-Path Utilities", () => {
  describe("getValueAtPath", () => {
    it("gets simple top-level property", () => {
      const obj = { heading: "Hello" };
      expect(getValueAtPath(obj, "heading")).toBe("Hello");
    });

    it("gets nested object property", () => {
      const obj = { badge: { label: "New" } };
      expect(getValueAtPath(obj, "badge.label")).toBe("New");
    });

    it("gets array item property", () => {
      const obj = { buttons: [{ label: "Click" }, { label: "Submit" }] };
      expect(getValueAtPath(obj, "buttons.0.label")).toBe("Click");
      expect(getValueAtPath(obj, "buttons.1.label")).toBe("Submit");
    });

    it("gets deeply nested property", () => {
      const obj = {
        sections: [{ content: { padding: { top: 16 } } }],
      };
      expect(getValueAtPath(obj, "sections.0.content.padding.top")).toBe(16);
    });

    it("returns undefined for invalid path", () => {
      const obj = { heading: "Hello" };
      expect(getValueAtPath(obj, "nonexistent")).toBeUndefined();
      expect(getValueAtPath(obj, "heading.nested")).toBeUndefined();
    });

    it("handles whitespace in paths", () => {
      const obj = { badge: { label: "New" } };
      expect(getValueAtPath(obj, "badge . label")).toBe("New");
    });
  });

  describe("setValueAtPath", () => {
    it("sets simple top-level property", () => {
      const obj = { heading: "Hello" };
      const result = setValueAtPath(obj, "heading", "World");
      expect(result).toEqual({ heading: "World" });
      expect(obj).toEqual({ heading: "Hello" }); // Original unchanged
    });

    it("sets nested object property", () => {
      const obj = { badge: { label: "New" } };
      const result = setValueAtPath(obj, "badge.label", "Updated");
      expect(result).toEqual({ badge: { label: "Updated" } });
      expect(obj).toEqual({ badge: { label: "New" } });
    });

    it("sets array item property", () => {
      const obj = { buttons: [{ label: "Click" }, { label: "Submit" }] };
      const result = setValueAtPath(obj, "buttons.0.label", "Go");
      expect(result).toEqual({ buttons: [{ label: "Go" }, { label: "Submit" }] });
      expect(obj.buttons[0].label).toBe("Click"); // Original unchanged
    });

    it("creates nested properties if they don't exist", () => {
      const obj: Record<string, unknown> = {};
      const result = setValueAtPath(obj, "badge.label", "New");
      expect(result).toEqual({ badge: { label: "New" } });
    });

    it("sets deeply nested property", () => {
      const obj = {
        sections: [{ content: { padding: { top: 16 } } }],
      };
      const result = setValueAtPath(
        obj,
        "sections.0.content.padding.top",
        32
      );
      expect(result).toEqual({
        sections: [{ content: { padding: { top: 32 } } }],
      });
      expect((obj.sections[0].content.padding as any).top).toBe(16); // Original unchanged
    });

    it("handles whitespace in paths", () => {
      const obj = { badge: { label: "New" } };
      const result = setValueAtPath(obj, "badge . label", "Updated");
      expect(result).toEqual({ badge: { label: "Updated" } });
    });

    it("returns same object for empty path", () => {
      const obj = { heading: "Hello" };
      const result = setValueAtPath(obj, "", "World");
      expect(result).toBe(obj);
    });
  });

  describe("addArrayItem", () => {
    it("adds item to existing array", () => {
      const obj = { buttons: [{ label: "A" }] };
      const result = addArrayItem(obj, "buttons", { label: "B" });
      expect(result).toEqual({
        buttons: [{ label: "A" }, { label: "B" }],
      });
      expect(obj.buttons).toHaveLength(1); // Original unchanged
    });

    it("adds item to nested array", () => {
      const obj = { section: { buttons: [{ label: "A" }] } };
      const result = addArrayItem(obj, "section.buttons", { label: "B" });
      expect(result).toEqual({
        section: { buttons: [{ label: "A" }, { label: "B" }] },
      });
    });

    it("does nothing if path is not an array", () => {
      const obj = { buttons: "not an array" };
      const result = addArrayItem(obj, "buttons", { label: "B" });
      expect(result).toEqual(obj);
    });

    it("adds primitive items", () => {
      const obj = { tags: ["a", "b"] };
      const result = addArrayItem(obj, "tags", "c");
      expect(result).toEqual({ tags: ["a", "b", "c"] });
    });
  });

  describe("removeArrayItem", () => {
    it("removes item from array by index", () => {
      const obj = { buttons: [{ label: "A" }, { label: "B" }, { label: "C" }] };
      const result = removeArrayItem(obj, "buttons", 1);
      expect(result).toEqual({
        buttons: [{ label: "A" }, { label: "C" }],
      });
      expect(obj.buttons).toHaveLength(3); // Original unchanged
    });

    it("removes first item", () => {
      const obj = { buttons: [{ label: "A" }, { label: "B" }] };
      const result = removeArrayItem(obj, "buttons", 0);
      expect(result).toEqual({ buttons: [{ label: "B" }] });
    });

    it("removes last item", () => {
      const obj = { buttons: [{ label: "A" }, { label: "B" }] };
      const result = removeArrayItem(obj, "buttons", 1);
      expect(result).toEqual({ buttons: [{ label: "A" }] });
    });

    it("does nothing for out-of-bounds index", () => {
      const obj = { buttons: [{ label: "A" }] };
      const result = removeArrayItem(obj, "buttons", 5);
      expect(result).toEqual(obj);
    });

    it("does nothing for negative index", () => {
      const obj = { buttons: [{ label: "A" }] };
      const result = removeArrayItem(obj, "buttons", -1);
      expect(result).toEqual(obj);
    });

    it("removes from nested array", () => {
      const obj = { section: { buttons: [{ label: "A" }, { label: "B" }] } };
      const result = removeArrayItem(obj, "section.buttons", 0);
      expect(result).toEqual({
        section: { buttons: [{ label: "B" }] },
      });
    });
  });

  describe("moveArrayItem", () => {
    it("moves item forward in array", () => {
      const obj = { buttons: [{ label: "A" }, { label: "B" }, { label: "C" }] };
      const result = moveArrayItem(obj, "buttons", 0, 2);
      expect(result).toEqual({
        buttons: [{ label: "B" }, { label: "C" }, { label: "A" }],
      });
      expect(obj.buttons[0].label).toBe("A"); // Original unchanged
    });

    it("moves item backward in array", () => {
      const obj = { buttons: [{ label: "A" }, { label: "B" }, { label: "C" }] };
      const result = moveArrayItem(obj, "buttons", 2, 0);
      expect(result).toEqual({
        buttons: [{ label: "C" }, { label: "A" }, { label: "B" }],
      });
    });

    it("moves adjacent items", () => {
      const obj = { buttons: [{ label: "A" }, { label: "B" }] };
      const result = moveArrayItem(obj, "buttons", 0, 1);
      expect(result).toEqual({
        buttons: [{ label: "B" }, { label: "A" }],
      });
    });

    it("returns same object when indices are equal", () => {
      const obj = { buttons: [{ label: "A" }, { label: "B" }] };
      const result = moveArrayItem(obj, "buttons", 0, 0);
      expect(result).toEqual(obj);
    });

    it("does nothing for out-of-bounds indices", () => {
      const obj = { buttons: [{ label: "A" }, { label: "B" }] };
      const result = moveArrayItem(obj, "buttons", 0, 5);
      expect(result).toEqual(obj);
    });

    it("does nothing for negative indices", () => {
      const obj = { buttons: [{ label: "A" }, { label: "B" }] };
      const result = moveArrayItem(obj, "buttons", -1, 0);
      expect(result).toEqual(obj);
    });

    it("moves items in nested array", () => {
      const obj = {
        section: { buttons: [{ label: "A" }, { label: "B" }, { label: "C" }] },
      };
      const result = moveArrayItem(obj, "section.buttons", 1, 0);
      expect(result).toEqual({
        section: { buttons: [{ label: "B" }, { label: "A" }, { label: "C" }] },
      });
    });
  });

  describe("integration tests", () => {
    it("complex object manipulation workflow", () => {
      let obj: Record<string, unknown> = {
        heading: "Welcome",
        buttons: [{ label: "Click", variant: "primary" }],
        padding: { top: 16, bottom: 16 },
      };

      // Add button
      obj = addArrayItem(obj, "buttons", { label: "Submit", variant: "secondary" });
      expect((obj.buttons as any[]).length).toBe(2);

      // Update heading
      obj = setValueAtPath(obj, "heading", "Hello");
      expect(getValueAtPath(obj, "heading")).toBe("Hello");

      // Update nested padding
      obj = setValueAtPath(obj, "padding.top", 32);
      expect(getValueAtPath(obj, "padding.top")).toBe(32);

      // Move button
      obj = moveArrayItem(obj, "buttons", 0, 1);
      expect((obj.buttons as any[])[0].label).toBe("Submit");

      // Remove button
      obj = removeArrayItem(obj, "buttons", 1);
      expect((obj.buttons as any[]).length).toBe(1);
    });

    it("preserves immutability across operations", () => {
      const original = {
        buttons: [{ label: "A" }, { label: "B" }],
        meta: { count: 2 },
      };

      const copy1 = JSON.parse(JSON.stringify(original));

      let modified = setValueAtPath(original, "buttons.0.label", "X");
      modified = addArrayItem(modified, "buttons", { label: "C" });
      modified = moveArrayItem(modified, "buttons", 0, 2);

      // Original should be completely unchanged
      expect(original).toEqual(copy1);
      expect((original.buttons as any[])[0].label).toBe("A");
      expect((original.buttons as any[]).length).toBe(2);
      expect((original.meta as any).count).toBe(2);

      // Modified should have all changes
      expect((modified.buttons as any[])[0].label).toBe("B");
      expect((modified.buttons as any[])[2].label).toBe("X");
      expect((modified.buttons as any[]).length).toBe(3);
    });
  });
});
