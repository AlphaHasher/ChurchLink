import { Label } from "@/shared/components/ui/label"
import { Textarea } from "@/shared/components/ui/textarea"
import { Checkbox } from "@/shared/components/ui/checkbox"

interface EventPaymentSettingsProps {
    payment_options?: string[]
    refund_policy?: string
    price?: number
    onChange?: (field: "payment_options" | "refund_policy", value: string[] | string) => void
}

export function EventPaymentSettings({
    payment_options = [],
    refund_policy = "",
    price = 0,
    onChange = () => { },
}: EventPaymentSettingsProps) {
    
    console.log('EventPaymentSettings props:', { payment_options, refund_policy, price })
    
    const isFreeEvent = price === 0
    const isPaidEvent = price > 0
    
    const handlePaymentOptionChange = (option: string, checked: boolean) => {
        console.log('Payment option change:', { option, checked, current: payment_options })
        let newOptions = [...payment_options]
        
        if (checked && !newOptions.includes(option)) {
            newOptions.push(option)
        } else if (!checked && newOptions.includes(option)) {
            newOptions = newOptions.filter(opt => opt !== option)
        }
        
        console.log('New payment options:', newOptions)
        onChange("payment_options", newOptions)
    }

    const handleRefundPolicyChange = (value: string) => {
        onChange("refund_policy", value)
    }

    return (
        <div className="space-y-6 p-4 border rounded-lg bg-muted">
            <h3 className="text-lg font-semibold text-foreground">Payment Settings</h3>
            
            {/* Status Display */}
            <div className="space-y-3">
                {isFreeEvent ? (
                    <div className="flex items-start space-x-3 p-3 border rounded-lg bg-muted">
                        <div className="flex-1">
                            <Label className="font-medium text-green-600">
                                🆓 Free Event
                            </Label>
                            <p className="text-sm text-green-600 mt-1">
                                Event price is $0 - payment options are optional
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start space-x-3 p-3 border rounded-lg bg-muted">
                        <div className="flex-1">
                            <Label className="font-medium text-destructive">
                                💳 Paid Event
                            </Label>
                            <p className="text-sm text-destructive mt-1">
                                Price: <strong>${price.toFixed(2)}</strong> - at least one payment option required
                            </p>
                        </div>
                    </div>
                )}
            </div>
            
            {/* Payment Options - Only show for paid events */}
            {isPaidEvent && (
                <div className="space-y-4">
                    <Label className="text-sm font-medium">Payment Options</Label>
                    
                    <div className="space-y-3">
                        {/* PayPal Option */}
                        <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent transition-colors">
                            <Checkbox
                                id="paypal"
                                checked={payment_options?.includes('paypal') || false}
                                onCheckedChange={(checked) => handlePaymentOptionChange('paypal', checked as boolean)}
                            />
                            <div className="flex-1">
                                <Label htmlFor="paypal" className="font-medium cursor-pointer">
                                    Pay with PayPal
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Accept payments through PayPal
                                </p>
                            </div>
                        </div>
                        
                        {/* Pay at Door Option */}
                        <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent transition-colors">
                            <Checkbox
                                id="door"
                                checked={payment_options?.includes('door') || false}
                                onCheckedChange={(checked) => handlePaymentOptionChange('door', checked as boolean)}
                            />
                            <div className="flex-1">
                                <Label htmlFor="door" className="font-medium cursor-pointer">
                                    Pay at Door
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Allow payment at the event location
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Validation Message */}
                    {isPaidEvent && (payment_options?.length || 0) === 0 && (
                        <div className="p-3 bg-muted border rounded-lg">
                            <p className="text-sm text-destructive">
                                ⚠️ Paid events must have at least one payment option selected
                            </p>
                        </div>
                    )}
                </div>
            )}
            
            {/* Free Event Message */}
            {isFreeEvent && (
                <div className="space-y-4">
                    <div className="p-3 bg-muted border rounded-lg">
                        <p className="text-sm text-blue-500">
                            💡 This is a free event. Payment options are not required, but you can optionally enable PayPal for donations.
                        </p>
                    </div>
                    
                    {/* Optional PayPal for donations on free events */}
                    <div className="space-y-3">
                        <Label className="text-sm font-medium">Optional Donation Settings</Label>
                        <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent transition-colors">
                            <Checkbox
                                id="paypal-donations"
                                checked={payment_options?.includes('paypal') || false}
                                onCheckedChange={(checked) => handlePaymentOptionChange('paypal', checked as boolean)}
                            />
                            <div className="flex-1">
                                <Label htmlFor="paypal-donations" className="font-medium cursor-pointer">
                                    Accept Donations via PayPal
                                </Label>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Allow attendees to make optional donations
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Refund Policy - Only show for paid events */}
            {isPaidEvent && (
                <div className="space-y-2">
                    <Label htmlFor="refund_policy" className="text-sm font-medium">
                        Refund Policy (Optional)
                    </Label>
                    <Textarea
                        id="refund_policy"
                        placeholder="Enter refund policy for this event..."
                        value={refund_policy}
                        onChange={(e) => handleRefundPolicyChange(e.target.value)}
                        className="min-h-[80px]"
                    />
                    <p className="text-xs text-gray-500">
                        Specify the refund terms for this event
                    </p>
                </div>
            )}
        </div>
    )
}