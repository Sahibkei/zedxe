"use client";

import { Component } from "react";

/**
 * Render a fallback when a child component throws.
 * @extends {Component}
 */
export default class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, info) {
        console.error("[ErrorBoundary] component error", { error, info });
    }

    render() {
        const { hasError } = this.state;
        const { fallback, children } = this.props;
        if (hasError) {
            return fallback ?? null;
        }
        return children;
    }
}
