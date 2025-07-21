import React, { useState, useEffect } from 'react';
import { getWaterContainers, createWaterContainer, updateWaterContainer, deleteWaterContainer, setPrimaryWaterContainer, WaterContainer } from '../services/waterContainerService';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { useToast } from '../hooks/use-toast';

const WaterContainerManager: React.FC = () => {
    const [containers, setContainers] = useState<WaterContainer[]>([]);
    const [name, setName] = useState('');
    const [volume, setVolume] = useState<number | ''>('');
    const [unit, setUnit] = useState<'ml' | 'oz' | 'cup'>('ml');
    const { toast } = useToast();

    useEffect(() => {
        fetchContainers();
    }, []);

    const fetchContainers = async () => {
        try {
            const fetchedContainers = await getWaterContainers();
            setContainers(fetchedContainers);
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to fetch water containers.', variant: 'destructive' });
        }
    };

    const handleAddContainer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name || volume === '') return;
        try {
            await createWaterContainer({ name, volume: Number(volume), unit, is_primary: false });
            toast({ title: 'Success', description: 'Water container added.' });
            fetchContainers();
            setName('');
            setVolume('');
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to add water container.', variant: 'destructive' });
        }
    };

    const handleDeleteContainer = async (id: number) => {
        try {
            await deleteWaterContainer(id);
            toast({ title: 'Success', description: 'Water container deleted.' });
            fetchContainers();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to delete water container.', variant: 'destructive' });
        }
    };

    const handleSetPrimary = async (id: number) => {
        try {
            await setPrimaryWaterContainer(id);
            toast({ title: 'Success', description: 'Primary container updated.' });
            fetchContainers();
        } catch (error) {
            toast({ title: 'Error', description: 'Failed to set primary container.', variant: 'destructive' });
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Manage Water Containers</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleAddContainer} className="flex items-end gap-2 mb-4">
                    <div className="grid gap-1.5">
                        <label htmlFor="name">Container Name</label>
                        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., My Water Bottle" required />
                    </div>
                    <div className="grid gap-1.5">
                        <label htmlFor="volume">Volume</label>
                        <Input id="volume" type="number" value={volume} onChange={(e) => setVolume(Number(e.target.value))} placeholder="e.g., 500" required />
                    </div>
                    <div className="grid gap-1.5">
                        <label>Unit</label>
                        <Select onValueChange={(value: 'ml' | 'oz' | 'cup') => setUnit(value)} defaultValue={unit}>
                            <SelectTrigger>
                                <SelectValue placeholder="Unit" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ml">ml</SelectItem>
                                <SelectItem value="oz">oz</SelectItem>
                                <SelectItem value="cup">cup</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button type="submit">Add Container</Button>
                </form>
                <div className="space-y-2">
                    {containers.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 border rounded-md">
                            <div>
                                <p className="font-semibold">{c.name} - {c.volume} {c.unit}</p>
                                {c.is_primary && <p className="text-sm text-blue-500">Primary</p>}
                            </div>
                            <div className="flex gap-2">
                                {!c.is_primary && <Button variant="outline" size="sm" onClick={() => handleSetPrimary(c.id)}>Set as Primary</Button>}
                                <Button variant="destructive" size="sm" onClick={() => handleDeleteContainer(c.id)}>Delete</Button>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default WaterContainerManager;